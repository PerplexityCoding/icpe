import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import './style.css';

let poiLayer = null;
let map = null;
let data = null;

const filters = {};
const filtersFields = ['num_dep', 'code_naf', 'lib_naf', 'regime', 'lib_regime', 'ippc', 'seveso', 'lib_seveso', 'Seveso', 'famille_ic'];
const selectedFilters = {};

async function main() {
    await fetchData();

    createFilers();
    displayFilters();

    map = createMap();
    reloadICPE();
}

function createMap() {
    const map = L.map('mapid').setView([48.393011982751744, -2.6470516079040847], 13);

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

async function fetchData() {
    data = await (await fetch('/icpe/data/icpe.geo.json')).json();
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
