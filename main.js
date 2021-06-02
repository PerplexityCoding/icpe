import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import './style.css';

let poiLayer = null;
let map = null;
let data = null;
let icon = null;

const filters = {};
const f = (key, label) => ({ key, label});
const filtersFields = [
    f('num_dep', 'Département'),
    f('code_naf', 'Code NAF'),
    f('lib_naf', 'Libéllé NAF'),
    f('regime', 'Code Régime'),
    f('lib_regime', 'Libéllé Regime'),
    f('lib_seveso', 'Libéllé SEVESO'),
    f('famille_ic', 'Famille IC'),
];

const searchTextFields = ['lib_naf', 'famille_ic', 'nom_ets', 'nomcommune'];
let selectedFilters = {};
let searchText = null;
let filtered = false;
let total = 0;
let maxTotal = 500;

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

    map.on('zoomend', reloadICPE);
    map.on('moveend', reloadICPE);

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
    data.features = data.features.sort(() => Math.random() - 0.5);
}

function createFilers() {
    for (const { key, label } of filtersFields) {
        const props = {};
        for (const feature of data.features) {
            props[feature.properties[key]] = true;
        }
        filters[key] = {
            label,
            items: Object.keys(props).sort()
        };
        if (filters[key].items[0] !== '') {
            filters[key].items.unshift('');
        }
    }
}

function displayFilters() {
    let filterHtml = '';

    filterHtml += `
        <fieldset class="search-bar">
            <label>Recherche </label><input type='text' class='search' />
        </fieldset>
        <p class="filters-title">
          Filtres
        </p>
    `;

    for (const [field, {label, items}] of Object.entries(filters)) {
        let options = '';
        for (const option of items) {
            options += `<option>${option}</option>`
        }

        filterHtml += `
            <fieldset>
                <label>${label}</label>
                <select name="${field}">${options}</select>
            </fieldset>
        `
    }

    filterHtml += `
        <button class='reset'>
            Réinitialiser
        </button>    

        <div class="pinNumber">
        </div>
    `;

    document.querySelector('.filters').innerHTML = filterHtml;
    document.querySelectorAll('select').forEach((select) => {
        select.addEventListener('change', (e) => {
            const fieldName = select.getAttribute('name');
            selectedFilters[fieldName] = select.value.trim();
            reloadICPE();
        });
    });

    const search = document.querySelector('.search');
    search.addEventListener('focusout', () => {
        const value = search.value.trim();
        searchText = value;
        reloadICPE();
    });
    search.addEventListener('keypress', (e) => {
        if (e.keyCode === 13) {
            const value = search.value.trim();
            searchText = value;
            reloadICPE();
        }
    });

    document.querySelector('.reset').addEventListener('click', () => {
        selectedFilters = {};
        maxTotal = 500;
        reloadICPE();
    });
}

function reloadICPE() {
    filtered = false;
    total = 0;

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

            if (total >= maxTotal) {
                filtered = true;
                return false;
            }

            if (searchText && searchText !== '' && searchText.length >= 3) {
                let match = false;
                for (const searchTextField of searchTextFields) {
                    if (properties[searchTextField].match(new RegExp(searchText, 'ig'))) {
                        match = true;
                        break;
                    }
                }

                if (! match) {
                    return false;
                }
            }

            const coord = feature.geometry.coordinates;
            const latlng = L.latLng(coord[1], coord[0]);

            if (! map.getBounds().contains(latlng)) {
                return false;
            }

            for (const [field, selectedFilterValue] of entries) {
                if (selectedFilterValue !== '' && properties[field] !== selectedFilterValue) {
                    return false;
                }
            }

            total++;
            return true;
        },
        onEachFeature: function (feature, layer) {
            let popupContent = '';

            if (feature.properties) {
                if (feature.properties.nom_ets) {
                    popupContent += `<b>${feature.properties.nom_ets}</b> <br />`;
                }
                if (feature.properties.lib_naf) {
                    popupContent += `${feature.properties.lib_naf} <br />`;
                }
                if (feature.properties.famille_ic) {
                    popupContent += `${feature.properties.famille_ic}  <br />`;
                }
                if (feature.properties.lib_seveso) {
                    popupContent += `${feature.properties.lib_seveso}  <br />`;
                }
                if (feature.properties.nomcommune) {
                    popupContent += `${feature.properties.nomcommune}  <br />`;
                }
                if (feature.properties.url_fiche) {
                    popupContent += `<br /><a target="_blank" href=${feature.properties.url_fiche}> voir fiche </a>`
                }
            }

            layer.bindPopup(popupContent);
        }
    }).addTo(map);

    const totalPins = poiLayer.getLayers().length;

    document.querySelector('.pinNumber').innerHTML =
        `
            <p class="search-result">
                Résultat de recherche: <b>${totalPins}</b> entrée(s)
                ${ filtered ? '<br /><br /><b>(Par soucis de performance, tous les élements ne sont pas afficher. Zoomer pour voir plus)</b> <br />': '' }
                <button class="addMaxTotal"> +500 </button>                
            </p>
        `
    ;
    document.querySelector('.addMaxTotal').addEventListener('click', () => maxTotal += 500);
}

main();
