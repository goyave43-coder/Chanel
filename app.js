// Initialisation de la carte (centrée sur l'Europe/Atlantique)
const map = L.map('map').setView([30, 0], 2);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

// Coordonnées (Fictives pour l'illustration globale)
const usineFrance = [46.2276, 2.2137];
const warehouses = [
    { id: 'WH_Ameriques', coords: [39.0, -95.0] },
    { id: 'WH_Asie', coords: [34.0, 100.0] }
];
const magasins = [
    { id: 'Mag_NY', coords: [40.7128, -74.0060], region: 'WH_Ameriques', stock: 100, marker: null },
    { id: 'Mag_Rio', coords: [-22.9068, -43.1729], region: 'WH_Ameriques', stock: 100, marker: null },
    { id: 'Mag_Tokyo', coords: [35.6762, 139.6503], region: 'WH_Asie', stock: 100, marker: null },
    { id: 'Mag_Singapour', coords: [1.3521, 103.8198], region: 'WH_Asie', stock: 100, marker: null }
];

let useWarehouses = false;
let lignesActives = [];

// Icône usine
L.circleMarker(usineFrance, { radius: 10, color: 'black', fillColor: 'black', fillOpacity: 1 }).addTo(map).bindPopup("Usine (France)");

// Initialisation des marqueurs magasins
magasins.forEach(mag => {
    // Stock important représenté par un grand cercle rose (Avant)[cite: 1].
    mag.marker = L.circleMarker(mag.coords, { radius: 15, color: '#ff66b2', fillColor: '#ffb6c1', fillOpacity: 0.7 }).addTo(map);
});

// Écouteur du bouton Toggle
document.getElementById('toggleWarehouse').addEventListener('change', function(e) {
    useWarehouses = e.target.checked;
    const statusText = document.getElementById('modeStatus');
    const logList = document.getElementById('logList');
    
    nettoyerLignes();

    if (useWarehouses) {
        statusText.innerHTML = "<strong>APRÈS :</strong> Lissage des stocks via Warehouses";
        log(logList, "Remontée d'informations depuis les Warehouse activée[cite: 1].");
        log(logList, "Commande uniquement quand il y a un manque[cite: 1].");
        
        // Affichage des Warehouses et flux d'informations (vert)[cite: 1].
        warehouses.forEach(wh => {
            L.circleMarker(wh.coords, { radius: 8, color: 'green', fillColor: 'white', fillOpacity: 1, weight: 3 }).addTo(map);
            tracerLigne(usineFrance, wh.coords, 'green', '5, 5'); // Ligne pointillée verte pour l'information
            tracerLigne(usineFrance, wh.coords, 'red', ''); // Ligne rouge pour la matière
        });

        // Les magasins passent en "stock faible" (petit cercle bleu)[cite: 1].
        magasins.forEach(mag => {
            mag.stock = 20; 
            mag.marker.setStyle({ radius: 6, color: '#0066cc', fillColor: '#add8e6' });
            const parentWh = warehouses.find(w => w.id === mag.region);
            tracerLigne(parentWh.coords, mag.coords, 'red', '');
        });

    } else {
        statusText.innerHTML = "<strong>AVANT :</strong> Flux tendu depuis l'usine (France)";
        log(logList, "Désactivation des Warehouses. Retour aux difficultés d'envoi[cite: 1].");
        
        // Retour au stock important (rose) et flux directs de matière (rouge)[cite: 1].
        magasins.forEach(mag => {
            mag.stock = 100;
            mag.marker.setStyle({ radius: 15, color: '#ff66b2', fillColor: '#ffb6c1' });
            tracerLigne(usineFrance, mag.coords, 'red', '');
        });
        
        // Recharger la page ou supprimer les marqueurs WH manuellement pour un vrai "reset" (simplifié ici)
        setTimeout(() => location.reload(), 1500); 
    }
});

// Simulation "en live" des ventes aléatoires
setInterval(() => {
    const logList = document.getElementById('logList');
    const randomMag = magasins[Math.floor(Math.random() * magasins.length)];
    const vente = Math.floor(Math.random() * 3) + 1;
    
    randomMag.stock -= vente;
    
    if (useWarehouses && randomMag.stock <= 5) {
        log(logList, `${randomMag.id} : Réapprovisionnement rapide depuis le Warehouse local.`);
        randomMag.stock += 15; // Lissage
    } else if (!useWarehouses && randomMag.stock <= 20) {
        log(logList, `${randomMag.id} : Alerte ! Commande massive envoyée à l'usine. Délai de livraison long.`);
        randomMag.stock += 80; // Surstockage forcé
    }
}, 3000);

// Fonctions utilitaires
function tracerLigne(depart, arrivee, couleur, dashArray) {
    const ligne = L.polyline([depart, arrivee], { color: couleur, weight: 2, dashArray: dashArray }).addTo(map);
    lignesActives.push(ligne);
}

function nettoyerLignes() {
    lignesActives.forEach(ligne => map.removeLayer(ligne));
    lignesActives = [];
}

function log(element, message) {
    const li = document.createElement('li');
    li.innerHTML = `<em>${new Date().toLocaleTimeString()}</em> : ${message}`;
    element.prepend(li);
}
