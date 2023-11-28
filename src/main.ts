import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import L from "leaflet";


const MERRILL_CLASSROOM = leaflet.latLng({
    lat: 36.9995,
    lng: - 122.0533
});

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 12;
const PIT_SPAWN_PROBABILITY = 0.1;
const MOVE_STEP = TILE_DEGREES * 2;

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
    center: MERRILL_CLASSROOM,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
}).addTo(map);

const playerMarker = leaflet.marker(MERRILL_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

let points = 0;
type MovementRecord = [number, number];
let movementHistory: MovementRecord[] = [];
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";
let collectedCoins: any[] = [];

class PitMemento {
    constructor(public coins: any) {}
}
  
class PitState {
    memento: PitMemento;
    constructor(public i: number, public j: number, public initialCoins: any[]) {
        this.memento = new PitMemento(initialCoins);
    }

    get coins() {
        return this.memento.coins;
    }

    set coins(value) {
        this.memento.coins = value;
    }

    saveState() {
        this.memento = new PitMemento(this.coins);
    }

    restoreState() {
        this.coins = this.memento.coins;
    }
}
  
const pitStates = new Map();

function latLngToGlobalCoords(lat: number, lng: number) {
    return {
        i: Math.floor(lat * 10000),
        j: Math.floor(lng * 10000)
    };
}

const gridCellFactory = (function() {
    interface Cell {
        i: number;
        j: number;
    }

    interface CellCache {
        [key: string]: Cell;
    }

    const cellCache: CellCache = {};

    return {
        getCell: function(i: number, j: number): Cell {
            const key = `${i}-${j}`;
            if (!cellCache[key]) {
                cellCache[key] = { i, j };
            }
            return cellCache[key];
        }
    };
})();

function createCoin(i: any, j: any, serial: any) {
    return { i, j, serial };
}

function makePit(i: number, j: number) {
    const globalCoords = latLngToGlobalCoords(MERRILL_CLASSROOM.lat + i * TILE_DEGREES, MERRILL_CLASSROOM.lng + j * TILE_DEGREES);
    const cell = gridCellFactory.getCell(globalCoords.i, globalCoords.j);
    
    const bounds = leaflet.latLngBounds([
        [MERRILL_CLASSROOM.lat + i * TILE_DEGREES, MERRILL_CLASSROOM.lng + j * TILE_DEGREES],
        [MERRILL_CLASSROOM.lat + (i + 1) * TILE_DEGREES, MERRILL_CLASSROOM.lng + (j + 1) * TILE_DEGREES],
    ]);
  
    const pit = leaflet.rectangle(bounds);
  
    let pitState: PitState;
    const key = `${i}-${j}`;
    if (pitStates.has(key)) {
      pitState = pitStates.get(key);
      pitState.restoreState();
    } else {
        const initialCoinCount = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
        const initialCoins = [];
        for (let serial = 0; serial < initialCoinCount; serial++) {
            initialCoins.push(createCoin(cell.i, cell.j, serial));
        }
        pitState = new PitState(i, j, initialCoins);
        pitStates.set(key, pitState);
    }
  
    pit.bindPopup(() => {
        const container = document.createElement("div");
        container.innerHTML = `<div>There is a pit here at "${cell.i},${cell.j}". It has <span id="coins">${pitState.coins.length}</span> geocoins.</div>
                               <button id="collect">Collect</button>
                               <button id="deposit">Deposit</button>`;
        
        const collectButton = container.querySelector<HTMLButtonElement>("#collect")!;
        const depositButton = container.querySelector<HTMLButtonElement>("#deposit")!;
        
        collectButton.addEventListener("click", () => {
            if (pitState.coins.length > 0) {
                const collectedCoin = pitState.coins.pop();
                collectedCoins.push(collectedCoin);
                points++;
                container.querySelector<HTMLSpanElement>("#coins")!.innerHTML = pitState.coins.length.toString();
                updateStatusPanel();
            }
        });
    
        depositButton.addEventListener("click", () => {
            if (points > 0) {
                pitState.coins.push(createCoin(cell.i, cell.j, pitState.coins.length));
                points--;
                container.querySelector<HTMLSpanElement>("#coins")!.innerHTML = pitState.coins.length.toString();
                statusPanel.innerHTML = `${points} geocoins remaining`;
            }
        });
  
        return container;
    });
  
    pit.addTo(map);
}

function updateStatusPanel() {
    const collectedCoinsText = collectedCoins.map(coin => JSON.stringify(coin)).join(", ");
    statusPanel.innerHTML = `${points} geocoins collected: [${collectedCoinsText}]`;
}

function movePlayer(latOffset: number, lngOffset: number) {
    const currentPos = playerMarker.getLatLng();
    playerMarker.setLatLng([currentPos.lat + latOffset, currentPos.lng + lngOffset]);
    map.panTo([currentPos.lat + latOffset, currentPos.lng + lngOffset]);
    regenerateCaches();
    addMovementToHistory(currentPos.lat + latOffset, currentPos.lng + lngOffset);
}

function addMovementToHistory(lat: number, lng: number) {
  movementHistory.push([lat, lng]);
  L.polyline(movementHistory, { color: 'blue' }).addTo(map);
}
  
function regenerateCaches() {
    map.eachLayer(layer => {
        if (layer !== playerMarker && !(layer instanceof L.TileLayer)) {
            map.removeLayer(layer);
        }
    });

    const playerPos = playerMarker.getLatLng();
    const iStart = Math.floor((playerPos.lat - MERRILL_CLASSROOM.lat) / TILE_DEGREES) - NEIGHBORHOOD_SIZE;
    const jStart = Math.floor((playerPos.lng - MERRILL_CLASSROOM.lng) / TILE_DEGREES) - NEIGHBORHOOD_SIZE;

    for (let i = iStart; i < iStart + NEIGHBORHOOD_SIZE * 2; i++) {
        for (let j = jStart; j < jStart + NEIGHBORHOOD_SIZE * 2; j++) {
            if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
                makePit(i, j);
            }
        }
    }
}

function resetGameState() {
    movementHistory = [];
    points = 0;
    statusPanel.innerHTML = "No points yet...";
    localStorage.clear();
    map.eachLayer(layer => {
        if (layer instanceof L.Polyline || (layer !== playerMarker && !(layer instanceof L.TileLayer))) {
        map.removeLayer(layer);
        }
    });
    playerMarker.setLatLng(MERRILL_CLASSROOM);
    map.panTo(MERRILL_CLASSROOM);
    regenerateCaches();
}

function updatePlayerPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        movePlayer(lat - playerMarker.getLatLng().lat, lng - playerMarker.getLatLng().lng);
      });
    }
}


document.getElementById("north")!.addEventListener("click", () => movePlayer(MOVE_STEP, 0));
document.getElementById("south")!.addEventListener("click", () => movePlayer(-MOVE_STEP, 0));
document.getElementById("east")!.addEventListener("click", () => movePlayer(0, MOVE_STEP));
document.getElementById("west")!.addEventListener("click", () => movePlayer(0, -MOVE_STEP));
document.getElementById("sensor")!.addEventListener("click", updatePlayerPosition);
document.getElementById("reset")!.addEventListener("click", resetGameState);

window.onunload = () => {
    const playerPosition = playerMarker.getLatLng();
  
    localStorage.setItem('points', JSON.stringify(points));
    localStorage.setItem('movementHistory', JSON.stringify(movementHistory));
    localStorage.setItem('playerPosition', JSON.stringify({ lat: playerPosition.lat, lng: playerPosition.lng }));
};

window.onload = () => {
    const savedPoints = localStorage.getItem('points');
    const savedHistory = localStorage.getItem('movementHistory');
    const savedPlayerPosition = localStorage.getItem('playerPosition');
  
    if (savedPoints !== null) {
      points = JSON.parse(savedPoints);
    }
  
    if (savedHistory !== null) {
      movementHistory = JSON.parse(savedHistory);
      L.polyline(movementHistory, { color: 'blue' }).addTo(map);
    }
  
    if (savedPlayerPosition !== null) {
      const { lat, lng } = JSON.parse(savedPlayerPosition);
      const newPosition = L.latLng(lat, lng);
      playerMarker.setLatLng(newPosition);
      map.panTo(newPosition);
    }
};

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = - NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
        if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
            makePit(i, j);
        }
    }
}