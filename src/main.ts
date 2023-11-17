import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";


const MERRILL_CLASSROOM = leaflet.latLng({
    lat: 36.9995,
    lng: - 122.0533
});

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 12;
const PIT_SPAWN_PROBABILITY = 0.1;

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
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

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
    let coins: { i: any; j: any; serial: any; }[] = [];
    for (let serial = 0; serial < luck([i, j, "initialValue"].toString()) * 100; serial++) {
        coins.push(createCoin(cell.i, cell.j, serial));
    }

    pit.bindPopup(() => {
        const container = document.createElement("div");
        container.innerHTML = `<div>There is a pit here at "${cell.i},${cell.j}". It has <span id="coins">${coins.length}</span> geocoins.</div>
                               <button id="collect">Collect</button>
                               <button id="deposit">Deposit</button>`;
        const collectButton = container.querySelector<HTMLButtonElement>("#collect")!;
        const depositButton = container.querySelector<HTMLButtonElement>("#deposit")!;

        collectButton.addEventListener("click", () => {
            if (coins.length > 0) {
                coins.pop(); // Remove one coin
                points++;
                container.querySelector<HTMLSpanElement>("#coins")!.innerHTML = coins.length.toString();
                statusPanel.innerHTML = `${points} geocoins collected`;
            }
        });

        depositButton.addEventListener("click", () => {
            if (points > 0) {
                coins.push(createCoin(cell.i, cell.j, coins.length)); // Add a new coin
                points--;
                container.querySelector<HTMLSpanElement>("#coins")!.innerHTML = coins.length.toString();
                statusPanel.innerHTML = `${points} geocoins remaining`;
            }
        });

        return container;
    });
    pit.addTo(map);
}

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = - NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
        if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
            makePit(i, j);
        }
    }
}