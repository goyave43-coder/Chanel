// 1. INITIALISATION DE LA CARTE
const map = L.map('map').setView([25, 0], 2);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

// 2. DONNÉES DE BASE
const usineFrance = [46.2276, 2.2137];
const warehouses = [
    { id: 'WH_Europe', coords: [50.0, 10.0], stock: 4000, enAttenteLivraison: false, marker: null },
    { id: 'WH_AmeriqueNord', coords: [40.0, -95.0], stock: 4000, enAttenteLivraison: false, marker: null },
    { id: 'WH_AmeriqueSud', coords: [-15.0, -55.0], stock: 2000, enAttenteLivraison: false, marker: null },
    { id: 'WH_Asie', coords: [35.0, 105.0], stock: 5000, enAttenteLivraison: false, marker: null },
    { id: 'WH_AfriqueMO', coords: [20.0, 25.0], stock: 2000, enAttenteLivraison: false, marker: null }
];

let magasins = [];
let lignesActives = [];
let useWarehouses = false;

// Variables pour les KPIs et Seuils
let totalCommandesClients = 0;
let commandesSatisfaitesSLA = 0;
let historiqueStockGlobal24h = []; // Garde les 24 dernières heures
let seuilMagasin = 15;
let seuilWarehouse = 1000;

// Écouteurs pour les curseurs (mise à jour en direct)
document.getElementById('seuilMagasin').addEventListener('input', (e) => {
    seuilMagasin = parseInt(e.target.value);
    document.getElementById('valSeuilMag').innerText = seuilMagasin;
});
document.getElementById('seuilWarehouse').addEventListener('input', (e) => {
    seuilWarehouse = parseInt(e.target.value);
    document.getElementById('valSeuilWh').innerText = seuilWarehouse;
});

// 3. GÉNÉRATION DES 100 MAGASINS
warehouses.forEach(wh => {
    for (let i = 0; i < 20; i++) {
        let latOffset = (Math.random() - 0.5) * 35;
        let lngOffset = (Math.random() - 0.5) * 45;
        magasins.push({
            id: `Mag_${wh.id}_${i}`,
            region: wh.id,
            coords: [wh.coords[0] + latOffset, wh.coords[1] + lngOffset],
            stock: 50,
            enAttenteLivraison: false,
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
        .addTo(map).bindPopup(`<b>Magasin</b><br>Stock: <span id="popup-${mag.id}">${mag.stock}</span>`);
});

// 5. GESTION DU BOUTON (AVANT / APRÈS)
document.getElementById('toggleWarehouse').addEventListener('change', function(e) {
    useWarehouses = e.target.checked;
    const statusText = document.getElementById('modeStatus');
    nettoyerLignes();
    
    // Reset KPIs
    totalCommandesClients = 0;
    commandesSatisfaitesSLA = 0;
    historiqueStockGlobal24h = []; // On réinitialise l'historique lors du changement de mode

    if (useWarehouses) {
        statusText.innerHTML = "<strong>APRÈS :</strong> Lissage via Warehouses";
        log("Réseau activé. Les magasins réduisent leurs stocks de sécurité.");
        warehouses.forEach(wh => wh.marker.getElement().style.display = 'block');
        magasins.forEach(mag => {
            mag.stock = 15; 
            mag.marker.setStyle({ color: '#0066cc', fillColor: '#add8e6' });
        });
    } else {
        statusText.innerHTML = "<strong>AVANT :</strong> Flux tendu depuis l'usine";
        log("Désactivation des Warehouses. Retour aux stocks massifs.");
        warehouses.forEach(wh => wh.marker.getElement().style.display = 'none');
        magasins.forEach(mag => {
            mag.stock = 50; 
            mag.marker.setStyle({ color: '#ff66b2', fillColor: '#ffb6c1' });
        });
    }
    updateKPIs();
});

// 6. LE MOTEUR DE SIMULATION
setInterval(() => {
    // A. Ventes aux clients
    for(let i=0; i<25; i++) {
        let randomMag = magasins[Math.floor(Math.random() * magasins.length)];
        totalCommandesClients++;

        if (randomMag.stock > 0) {
            randomMag.stock--;
            commandesSatisfaitesSLA++; 
        } else {
            if (useWarehouses) commandesSatisfaitesSLA++; 
        }
    }

    // B. Réapprovisionnement des Magasins
    magasins.forEach(mag => {
        // En mode "Avant", la panique force un réapprovisionnement constant (seuil très haut). En mode "Après", on utilise le curseur.
        let seuilAlerte = useWarehouses ? seuilMagasin : 40; 
        
        if (mag.stock <= seuilAlerte && !mag.enAttenteLivraison) {
            mag.enAttenteLivraison = true;
            
            if (useWarehouses) {
                let parentWh = warehouses.find(w => w.id === mag.region);
                if(parentWh.stock > 20) {
                    parentWh.stock -= 20;
                    animerLivraison(parentWh.coords, mag.coords, 'green', mag, 20, false);
                } else {
                    mag.enAttenteLivraison = false; // Le WH est vide, le magasin attend !
                }
            } else {
                animerLivraison(usineFrance, mag.coords, 'red', mag, 50, false);
            }
        }
    });

    // C. Réapprovisionnement des Warehouses
    if (useWarehouses) {
        warehouses.forEach(wh => {
            if (wh.stock <= seuilWarehouse && !wh.enAttenteLivraison) {
                wh.enAttenteLivraison = true;
                // Commande massive à l'usine en France
                animerLivraison(usineFrance, wh.coords, 'purple', wh, 2000, true);
                if(Math.random() > 0.5) log(`Warehouse ${wh.id} passe sous le seuil. Commande usine lancée.`);
            }
        });
    }

    // D. Calcul du Stock Global pour le KPI 24h
    let totalStockMagasins = magasins.reduce((sum, mag) => sum + mag.stock, 0);
    let totalStockWarehouses = useWarehouses ? warehouses.reduce((sum, wh) => sum + wh.stock, 0) : 0;
    let stockMondialActuel = totalStockMagasins + totalStockWarehouses;
    
    historiqueStockGlobal24h.push(stockMondialActuel);
    if (historiqueStockGlobal24h.length > 24) {
        historiqueStockGlobal24h.shift(); // Retire la donnée la plus vieille (glissement sur 24 ticks)
    }

    updateKPIs();
}, 200);

// 7. FONCTIONS UTILITAIRES
function animerLivraison(depart, arrivee, couleur, cible, quantiteLivree, isWarehouseReappro) {
    let epaisseur = isWarehouseReappro ? 4 : 1.5; // Ligne plus épaisse pour les expéditions usine -> WH
    let opacite = isWarehouseReappro ? 0.8 : 0.6;
    let ligne = L.polyline([depart, arrivee], { color: couleur, weight: epaisseur, opacity: opacite, dashArray: isWarehouseReappro ? '5, 5' : '' }).addTo(map);
    lignesActives.push(ligne);
    
    // L'usine met beaucoup plus de temps à livrer un WH que le WH à livrer un magasin
    let tempsTrajet = isWarehouseReappro ? 4000 : (useWarehouses ? 800 : 4000); 

    setTimeout(() => {
        map.removeLayer(ligne);
        cible.stock += quantiteLivree;
        cible.enAttenteLivraison = false;
    }, tempsTrajet);
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
    // 1. Taux de Service
    if (totalCommandesClients > 0) {
        let taux = (commandesSatisfaitesSLA / totalCommandesClients) * 100;
        let kpiElement = document.getElementById('kpi-service');
        kpiElement.innerText = taux.toFixed(1) + "%";
        if(taux < 85) kpiElement.style.color = "#d9534f";
        else if(taux < 95) kpiElement.style.color = "#f0ad4e";
        else kpiElement.style.color = "#5cb85c";
    }

    // 2. Stock Moyen Magasin
    let totalMag = magasins.reduce((sum, mag) => sum + mag.stock, 0);
    document.getElementById('kpi-stock').innerText = Math.round(totalMag / magasins.length);

    // 3. Stock Global Moyen 24h
    if (historiqueStockGlobal24h.length > 0) {
        let somme24h = historiqueStockGlobal24h.reduce((a, b) => a + b, 0);
        let moyenne24h = somme24h / historiqueStockGlobal24h.length;
        // toLocaleString() permet d'ajouter les espaces pour les milliers (ex: 12 500)
        document.getElementById('kpi-global').innerText = Math.round(moyenne24h).toLocaleString('fr-FR');
    }

    // Mise à jour visuelle des bulles cliquées
    magasins.forEach(mag => { let el = document.getElementById(`popup-${mag.id}`); if(el) el.innerText = mag.stock; });
    warehouses.forEach(wh => { let el = document.getElementById(`popup-${wh.id}`); if(el) el.innerText = wh.stock; });
}
