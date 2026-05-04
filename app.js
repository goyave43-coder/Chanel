// 1. INITIALISATION DE LA CARTE
const map = L.map('map').setView([25, 0], 2);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

// 2. DONNÉES DE BASE (Ajout de la variable "enCommande" pour permettre les flux multiples)
const usineFrance = [46.2276, 2.2137];
const warehouses = [
    { id: 'WH_Europe', coords: [48.0, 15.0], stock: 500, enCommande: 0, marker: null }, 
    { id: 'WH_AmeriqueNord', coords: [40.0, -100.0], stock: 500, enCommande: 0, marker: null }, 
    { id: 'WH_AmeriqueSud', coords: [-10.0, -55.0], stock: 500, enCommande: 0, marker: null }, 
    { id: 'WH_Asie', coords: [35.0, 105.0], stock: 500, enCommande: 0, marker: null }, 
    { id: 'WH_AfriqueMO', coords: [15.0, 20.0], stock: 500, enCommande: 0, marker: null } 
];

let magasins = [];
let lignesActives = [];
let useWarehouses = false;

// Variables pour les KPIs
let historiqueCommandes24h = [];
let historiqueSatisfaites24h = [];
let historiqueStockGlobal24h = []; 

// Variables pour les Paramètres Réglables
let seuilMagasin = parseInt(document.getElementById('seuilMagasin').value) || 5;
let lotMagasin = parseInt(document.getElementById('lotMagasin').value) || 15;
let seuilWarehouse = parseInt(document.getElementById('seuilWarehouse').value) || 300;
let lotWarehouse = parseInt(document.getElementById('lotWarehouse').value) || 400;
let speedMultiplier = parseInt(document.getElementById('vitesseSimu').value) || 1;

// Écouteurs pour les curseurs
document.getElementById('seuilMagasin').addEventListener('input', (e) => {
    seuilMagasin = parseInt(e.target.value); document.getElementById('valSeuilMag').innerText = seuilMagasin;
});
document.getElementById('lotMagasin').addEventListener('input', (e) => {
    lotMagasin = parseInt(e.target.value); document.getElementById('valLotMag').innerText = lotMagasin;
});
document.getElementById('seuilWarehouse').addEventListener('input', (e) => {
    seuilWarehouse = parseInt(e.target.value); document.getElementById('valSeuilWh').innerText = seuilWarehouse;
});
document.getElementById('lotWarehouse').addEventListener('input', (e) => {
    lotWarehouse = parseInt(e.target.value); document.getElementById('valLotWh').innerText = lotWarehouse;
});
document.getElementById('vitesseSimu').addEventListener('input', (e) => {
    speedMultiplier = parseInt(e.target.value); document.getElementById('valVitesse').innerText = "x" + speedMultiplier;
});

// 3. GÉNÉRATION DES 100 MAGASINS
warehouses.forEach(wh => {
    for (let i = 0; i < 20; i++) {
        let latOffset = (Math.random() - 0.5) * 80;
        let lngOffset = (Math.random() - 0.5) * 120;
        magasins.push({
            id: `Mag_${wh.id}_${i}`,
            region: wh.id,
            coords: [wh.coords[0] + latOffset, wh.coords[1] + lngOffset],
            stock: lotMagasin * 2, 
            enCommande: 0,
            marker: null
        });
    }
});

// 4. AFFICHAGE DES MARQUEURS
L.circleMarker(usineFrance, { radius: 10, color: 'black', fillColor: 'black', fillOpacity: 1 }).addTo(map).bindPopup("<b>Usine (France)</b>");

warehouses.forEach(wh => {
    wh.marker = L.circleMarker(wh.coords, { radius: 8, color: 'green', fillColor: 'white', fillOpacity: 1, weight: 3 })
        .addTo(map).bindPopup(`<b>${wh.id}</b><br>Stock global: <span id="popup-${wh.id}">${wh.stock}</span>`);
    wh.marker.getElement().style.display = 'none';
});

magasins.forEach(mag => {
    mag.marker = L.circleMarker(mag.coords, { radius: 4, color: '#ff66b2', fillColor: '#ffb6c1', fillOpacity: 0.7 })
        .addTo(map)
        .bindPopup(`<b>Magasin</b><br>Stock: <span id="popup-${mag.id}">${mag.stock}</span>`)
        .bindTooltip("Livraison : 7 à 10 jours (Depuis l'Usine)", {direction: 'top', opacity: 0.9});
});

// 5. GESTION DU BOUTON (AVANT / APRÈS)
document.getElementById('toggleWarehouse').addEventListener('change', function(e) {
    useWarehouses = e.target.checked;
    const statusText = document.getElementById('modeStatus');
    nettoyerLignes();
    
    historiqueCommandes24h = [];
    historiqueSatisfaites24h = [];
    historiqueStockGlobal24h = []; 

    if (useWarehouses) {
        statusText.innerHTML = "<strong>APRÈS :</strong> Lissage via Warehouses";
        log("Réseau activé. Remontée d'infos rapide.");
        warehouses.forEach(wh => wh.marker.getElement().style.display = 'block');
        magasins.forEach(mag => {
            mag.marker.setStyle({ color: '#0066cc', fillColor: '#add8e6' });
            mag.marker.setTooltipContent("Livraison : < 24h (Depuis le Warehouse)");
        });
    } else {
        statusText.innerHTML = "<strong>AVANT :</strong> Flux tendu depuis l'usine";
        log("Désactivation des Warehouses. Retour aux flux directs massifs.");
        warehouses.forEach(wh => wh.marker.getElement().style.display = 'none');
        magasins.forEach(mag => {
            mag.marker.setStyle({ color: '#ff66b2', fillColor: '#ffb6c1' });
            mag.marker.setTooltipContent("Livraison : 7 à 10 jours (Depuis l'Usine)");
        });
    }
    updateKPIs();
});

// 6. LE MOTEUR DE SIMULATION
function simulationLoop() {
    let commandesHeureActuelle = 0;
    let satisfaitesHeureActuelle = 0;

    // A. Ventes aux clients
    for(let i=0; i<25; i++) {
        let randomMag = magasins[Math.floor(Math.random() * magasins.length)];
        commandesHeureActuelle++;

        if (randomMag.stock > 0) {
            randomMag.stock--;
            satisfaitesHeureActuelle++; 
        } else {
            if (useWarehouses) satisfaitesHeureActuelle++; 
        }
    }

    historiqueCommandes24h.push(commandesHeureActuelle);
    historiqueSatisfaites24h.push(satisfaitesHeureActuelle);
    if (historiqueCommandes24h.length > 24) {
        historiqueCommandes24h.shift();
        historiqueSatisfaites24h.shift();
    }

    // B. Réapprovisionnement des Magasins (Logique de stock prévisionnel)
    magasins.forEach(mag => {
        if ((mag.stock + mag.enCommande) <= seuilMagasin) {
            mag.enCommande += lotMagasin; // Le magasin anticipe l'arrivée du lot
            
            if (useWarehouses) {
                let parentWh = warehouses.find(w => w.id === mag.region);
                if(parentWh.stock >= lotMagasin) { 
                    parentWh.stock -= lotMagasin;
                    animerLivraison(parentWh.coords, mag.coords, 'green', mag, lotMagasin, false);
                } else {
                    mag.enCommande -= lotMagasin; // Annulation si le WH est vide
                }
            } else {
                animerLivraison(usineFrance, mag.coords, 'red', mag, lotMagasin, false);
            }
        }
    });

    // C. Réapprovisionnement des Warehouses (Peut lancer plusieurs camions à la suite !)
    if (useWarehouses) {
        warehouses.forEach(wh => {
            if ((wh.stock + wh.enCommande) <= seuilWarehouse) {
                wh.enCommande += lotWarehouse; // Le WH anticipe l'arrivée de la marchandise
                animerLivraison(usineFrance, wh.coords, 'purple', wh, lotWarehouse, true);
                if(Math.random() > 0.5) log(`Warehouse ${wh.id} sous le seuil. Expédition de ${lotWarehouse} unités en cours.`);
            }
        });
    }

    // D. Calcul du Stock Global pour le KPI 24h
    let totalStockMagasins = magasins.reduce((sum, mag) => sum + mag.stock, 0);
    let totalStockWarehouses = useWarehouses ? warehouses.reduce((sum, wh) => sum + wh.stock, 0) : 0;
    let stockMondialActuel = totalStockMagasins + totalStockWarehouses;
    
    historiqueStockGlobal24h.push(stockMondialActuel);
    if (historiqueStockGlobal24h.length > 24) { historiqueStockGlobal24h.shift(); }

    updateKPIs();
    setTimeout(simulationLoop, 200 / speedMultiplier);
}

// 7. FONCTIONS UTILITAIRES
function animerLivraison(depart, arrivee, couleur, cible, quantiteLivree, isWarehouseReappro) {
    // Petit décalage aléatoire des lignes pour visualiser les camions multiples
    let offsetLat = (Math.random() - 0.5) * 1.5;
    let offsetLng = (Math.random() - 0.5) * 1.5;
    let departMod = [depart[0] + offsetLat, depart[1] + offsetLng];
    let arriveeMod = [arrivee[0] + offsetLat, arrivee[1] + offsetLng];

    let epaisseur = isWarehouseReappro ? 4 : 1.5; 
    let opacite = isWarehouseReappro ? 0.8 : 0.6;
    
    // Ajout de la classe "transit-line" pour l'animation CSS
    let ligne = L.polyline([departMod, arriveeMod], { 
        color: couleur, 
        weight: epaisseur, 
        opacity: opacite, 
        dashArray: '8, 8', 
        className: 'transit-line' 
    }).addTo(map);
    
    lignesActives.push(ligne);
    
    // TEMPS DE TRAJET : 15 secondes réelles depuis la France (long), 2 secondes depuis le Warehouse local (rapide).
    let tempsTrajetDeBase = isWarehouseReappro ? 15000 : (useWarehouses ? 2000 : 15000); 
    let tempsTrajetReel = tempsTrajetDeBase / speedMultiplier;

    setTimeout(() => {
        map.removeLayer(ligne);
        let index = lignesActives.indexOf(ligne);
        if (index > -1) { lignesActives.splice(index, 1); }

        cible.stock += quantiteLivree;
        cible.enCommande -= quantiteLivree; // Le camion est arrivé, on retire de "en commande"
    }, tempsTrajetReel);
}

function nettoyerLignes() {
    lignesActives.forEach(ligne => map.removeLayer(ligne));
    lignesActives = [];
}

function log(message) {
    const logList = document.getElementById('logList');
    const li = document.createElement('li');
    li.innerHTML = `<em>${new Date().toLocaleTimeString()}</em> : ${message}`;
    logList.prepend(li);
    if(logList.children.length > 40) logList.lastChild.remove();
}

function updateKPIs() {
    let totalCmd24h = historiqueCommandes24h.reduce((a, b) => a + b, 0);
    let totalSat24h = historiqueSatisfaites24h.reduce((a, b) => a + b, 0);

    if (totalCmd24h > 0) {
        let taux = (totalSat24h / totalCmd24h) * 100;
        let kpiElement = document.getElementById('kpi-service');
        kpiElement.innerText = taux.toFixed(1) + "%";
        if(taux < 85) kpiElement.style.color = "#d9534f";
        else if(taux < 95) kpiElement.style.color = "#f0ad4e";
        else kpiElement.style.color = "#5cb85c";
    }

    let totalMag = magasins.reduce((sum, mag) => sum + mag.stock, 0);
    document.getElementById('kpi-stock').innerText = Math.round(totalMag / magasins.length);

    if (historiqueStockGlobal24h.length > 0) {
        let somme24h = historiqueStockGlobal24h.reduce((a, b) => a + b, 0);
        let moyenne24h = somme24h / historiqueStockGlobal24h.length;
        document.getElementById('kpi-global').innerText = Math.round(moyenne24h).toLocaleString('fr-FR');
    }

    magasins.forEach(mag => { let el = document.getElementById(`popup-${mag.id}`); if(el) el.innerText = mag.stock; });
    warehouses.forEach(wh => { let el = document.getElementById(`popup-${wh.id}`); if(el) el.innerText = wh.stock; });
}

// LANCEMENT INITIAL
simulationLoop();
