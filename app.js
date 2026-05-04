// 1. INITIALISATION DE LA CARTE
const map = L.map('map').setView([25, 0], 2);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

// 2. DONNÉES DE BASE
const usineFrance = [46.2276, 2.2137];
const warehouses = [
    { id: 'WH_Europe', coords: [50.0, 10.0], stock: 5000, marker: null },
    { id: 'WH_AmeriqueNord', coords: [40.0, -95.0], stock: 5000, marker: null },
    { id: 'WH_AmeriqueSud', coords: [-15.0, -55.0], stock: 3000, marker: null },
    { id: 'WH_Asie', coords: [35.0, 105.0], stock: 6000, marker: null },
    { id: 'WH_AfriqueMO', coords: [20.0, 25.0], stock: 2000, marker: null }
];

let magasins = [];
let lignesActives = [];
let useWarehouses = false;

// Variables pour les KPIs
let totalCommandesClients = 0;
let commandesSatisfaitesSLA = 0; // Satisfaites en moins de 24h

// 3. GÉNÉRATION DES 100 MAGASINS
warehouses.forEach(wh => {
    for (let i = 0; i < 20; i++) {
        let latOffset = (Math.random() - 0.5) * 35;
        let lngOffset = (Math.random() - 0.5) * 45;
        
        magasins.push({
            id: `Mag_${wh.id}_${i}`,
            region: wh.id,
            coords: [wh.coords[0] + latOffset, wh.coords[1] + lngOffset],
            stock: 50, // Stock historique élevé
            enAttenteLivraison: false,
            marker: null
        });
    }
});

// 4. AFFICHAGE DES MARQUEURS
L.circleMarker(usineFrance, { radius: 10, color: 'black', fillColor: 'black', fillOpacity: 1 })
    .addTo(map).bindPopup("<b>Usine (France)</b>");

warehouses.forEach(wh => {
    wh.marker = L.circleMarker(wh.coords, { radius: 8, color: 'green', fillColor: 'white', fillOpacity: 1, weight: 3 })
        .addTo(map)
        .bindPopup(`<b>${wh.id}</b><br>Stock global: <span id="popup-${wh.id}">${wh.stock}</span>`);
    wh.marker.getElement().style.display = 'none'; // Cachés par défaut
});

magasins.forEach(mag => {
    mag.marker = L.circleMarker(mag.coords, { radius: 4, color: '#ff66b2', fillColor: '#ffb6c1', fillOpacity: 0.7 })
        .addTo(map)
        .bindPopup(`<b>Magasin</b><br>Stock: <span id="popup-${mag.id}">${mag.stock}</span>`);
});

// 5. GESTION DU BOUTON (AVANT / APRÈS)
document.getElementById('toggleWarehouse').addEventListener('change', function(e) {
    useWarehouses = e.target.checked;
    const statusText = document.getElementById('modeStatus');
    nettoyerLignes();
    
    // Reset KPIs au changement de mode pour bien voir la différence
    totalCommandesClients = 0;
    commandesSatisfaitesSLA = 0;

    if (useWarehouses) {
        statusText.innerHTML = "<strong>APRÈS :</strong> Lissage via Warehouses";
        log("Réseau activé. Remontée d'informations. Baisse des stocks magasins.");
        warehouses.forEach(wh => wh.marker.getElement().style.display = 'block');
        magasins.forEach(mag => {
            mag.stock = 10; // Le magasin vide son stock car il a confiance
            mag.marker.setStyle({ color: '#0066cc', fillColor: '#add8e6' });
        });
    } else {
        statusText.innerHTML = "<strong>AVANT :</strong> Flux tendu depuis l'usine";
        log("Désactivation des Warehouses. Retour aux stocks de sécurité massifs.");
        warehouses.forEach(wh => wh.marker.getElement().style.display = 'none');
        magasins.forEach(mag => {
            mag.stock = 50; // Le magasin sur-stocke pour palier la lenteur
            mag.marker.setStyle({ color: '#ff66b2', fillColor: '#ffb6c1' });
        });
    }
    updateKPIs();
});

// 6. LE MOTEUR DE SIMULATION (Temps réel)
setInterval(() => {
    // A. Ventes aux clients (25 ventes aléatoires par "heure")
    for(let i=0; i<25; i++) {
        let randomMag = magasins[Math.floor(Math.random() * magasins.length)];
        totalCommandesClients++;

        if (randomMag.stock > 0) {
            randomMag.stock--;
            commandesSatisfaitesSLA++; // Achat immédiat = Client très satisfait
        } else {
            // Rupture ! SLA dépend du temps de livraison
            if (useWarehouses) {
                commandesSatisfaitesSLA++; // WH livre en < 24h, SLA respecté
            } else {
                // France livre en 7 à 10 jours, SLA NON respecté
            }
        }
    }

    // B. Réapprovisionnement des magasins
    magasins.forEach(mag => {
        let seuilAlerte = useWarehouses ? 5 : 20; 
        
        if (mag.stock <= seuilAlerte && !mag.enAttenteLivraison) {
            mag.enAttenteLivraison = true;
            
            if (useWarehouses) {
                // Via Warehouse (Rapide et lissé)
                let parentWh = warehouses.find(w => w.id === mag.region);
                parentWh.stock -= 20;
                animerLivraison(parentWh.coords, mag.coords, 'green', mag, 20);
                if(Math.random() > 0.96) log(`Réappro. rapide depuis Warehouse ${parentWh.id}`);
            } else {
                // Via Usine Centrale (Lent et massif)
                animerLivraison(usineFrance, mag.coords, 'red', mag, 50);
                if(Math.random() > 0.98) log(`Rupture imminente ! Commande d'urgence à l'usine.`);
            }
        }
    });

    updateKPIs();
}, 200); // Vitesse de la boucle

// 7. FONCTIONS UTILITAIRES
function animerLivraison(depart, arrivee, couleur, magasin, quantiteLivree) {
    let ligne = L.polyline([depart, arrivee], { color: couleur, weight: 1.5, opacity: 0.6 }).addTo(map);
    lignesActives.push(ligne);
    
    // Temps de trajet simulé (court pour WH, long pour France)
    let tempsTrajet = useWarehouses ? 800 : 4000; 

    setTimeout(() => {
        map.removeLayer(ligne);
        magasin.stock += quantiteLivree;
        magasin.enAttenteLivraison = false;
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
    // Mise à jour Stock Moyen
    let totalStock = magasins.reduce((sum, mag) => sum + mag.stock, 0);
    document.getElementById('kpi-stock').innerText = Math.round(totalStock / magasins.length);

    // Mise à jour Taux de Service
    if (totalCommandesClients > 0) {
        let taux = (commandesSatisfaitesSLA / totalCommandesClients) * 100;
        let kpiElement = document.getElementById('kpi-service');
        kpiElement.innerText = taux.toFixed(1) + "%";
        
        // Code couleur pour l'alerte
        if(taux < 85) kpiElement.style.color = "#d9534f"; // Rouge
        else if(taux < 95) kpiElement.style.color = "#f0ad4e"; // Orange
        else kpiElement.style.color = "#5cb85c"; // Vert
    }

    // Mise à jour visuelle des bulles cliquées
    magasins.forEach(mag => {
        let el = document.getElementById(`popup-${mag.id}`);
        if(el) el.innerText = mag.stock;
    });
    warehouses.forEach(wh => {
        let el = document.getElementById(`popup-${wh.id}`);
        if(el) el.innerText = wh.stock;
    });
}
