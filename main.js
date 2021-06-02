import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import './style.css';

let poiLayer = null;
let map = null;
let data = null;
let icon = null;

const filters = {};
const filtersFields = ['num_dep', 'code_naf', 'lib_naf', 'regime', 'lib_regime', 'ippc', 'seveso', 'lib_seveso', 'Seveso', 'famille_ic'];
const selectedFilters = {};

async function main() {
    await fetchData();

    createFilers();
    displayFilters();

    createIcon()
    createMap();
    reloadICPE();
}

function createMap() {
    map = L.map('mapid').setView([48.393011982751744, -2.6470516079040847], 13);

    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: 'pk.eyJ1IjoieW1lbmFyZC1kZXYiLCJhIjoiY2twZWc3emZtMGxzYTJubzhyZnp6ZHJveSJ9.ub0yDhdRQ-dWyKBs7KR1wQ'
    }).addTo(map);

    return map;
}

function createIcon() {
    icon = L.icon({
        iconUrl: '/icpe/assets/img/map-marker-icon.png',

        iconSize:     [32, 32], // size of the icon
        shadowSize:   [50, 64], // size of the shadow
        iconAnchor:   [32, 32], // point of the icon which will correspond to marker's location
        shadowAnchor: [4, 62],  // the same for the shadow
        popupAnchor:  [-16, -32] // point from which the popup should open relative to the iconAnchor
    });
}

async function fetchData() {
    data = await (await fetch('/icpe/assets/data/icpe.geo.json')).json();
}

function createFilers() {
    for (const field of filtersFields) {
        const props = {};
        for (const feature of data.features) {
            props[feature.properties[field]] = true;
        }
        filters[field] = Object.keys(props).sort();
        if (filters[field][0] !== '') {
            filters[field].unshift('');
        }
    }
}

function displayFilters() {
    let filterHtml = '';

    for (const [field, filter] of Object.entries(filters)) {
        let options = '';
        for (const option of filter) {
            options += `<option>${option}</option>`
        }

        filterHtml += `
            <fieldset>
                <label>${field}</label>
                <select name="${field}">${options}</select>
            </fieldset>        
        `
    }

    filterHtml += `
        <button class='refresh'>
            Refresh
        </button>      
    `;

    document.querySelector('.filters').innerHTML = filterHtml;
    document.querySelectorAll('select').forEach((select) => {
        select.addEventListener('change', (e) => {
            const fieldName = select.getAttribute('name');
            selectedFilters[fieldName] = select.value.trim();
            reloadICPE();
        });
    });
    document.querySelector('.refresh').addEventListener('click', () => {
        reloadICPE();
    });
}

function reloadICPE() {
    if (poiLayer) {
        poiLayer.remove();
    }

    poiLayer = L.geoJSON(data.features, {
        pointToLayer: function(feature, latlng) {
            return L.marker(latlng, {
                icon
            });
        },
        filter: function (feature, layer) {
            const properties = feature.properties;
            const entries = Object.entries(selectedFilters);

            if (entries.length == 0) {
                return false;
            }

            const coord = feature.geometry.coordinates;
            const latlng = L.latLng(coord[1], coord[0]);

            if (! map.getBounds().contains(latlng)) {
                return false;
            }

            for (const [field, selectedFilterValue] of entries) {
                if (properties[field] !== selectedFilterValue) {
                    return false;
                }
            }
            return true;
        },
        onEachFeature: function (feature, layer) {
            let popupContent = '';

            if (feature.properties) {
                if (feature.properties.nom_ets) {
                    popupContent += feature.properties.nom_ets;
                }
                if (feature.properties.url_fiche) {
                    popupContent += `<br /><a target="_blank" href=${feature.properties.url_fiche}> voir fiche </a>`
                }
            }

            layer.bindPopup(popupContent);
        }
    }).addTo(map);
}

main();
