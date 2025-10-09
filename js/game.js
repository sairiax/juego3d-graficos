// Glitch shaders
const glitchVertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    uniform float time;
    float hash(vec3 p3) {
        p3  = fract(p3 * 0.3183099 + 0.1);
        return fract(sin(dot(p3, vec3(127.1, 311.7, 74.7))) * 43758.5453);
    }
    void main() {
        vUv = uv;
        vPosition = position;
        vec3 pos = position;
        vec3 p = pos + time * 1.0; // Faster change
        float h = hash(p);
        pos.xyz += (h * 2.0 - 1.0) * 0.3; // Stronger displacement
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const glitchFragmentShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    uniform float time;
    uniform vec3 baseColor;
    float hash(vec3 p3) {
        p3  = fract(p3 * 0.3183099 + 0.1);
        return fract(sin(dot(p3, vec3(127.1, 311.7, 74.7))) * 43758.5453);
    }
    void main() {
        vec3 col = baseColor;
        vec3 p = vPosition + time * 0.6; // Faster
        float h = hash(p * 0.1);
        col.rgb += (h - 0.5) * 1.0; // Stronger color shift
        float lineh = fract(sin(dot(vPosition.xy, vec2(12.9898, 78.233))) * 43758.5453);
        if (lineh > 0.95) {
            col += vec3(0.0, 1.0, 0.0) * 0.8; // Stronger scanlines
        }
        gl_FragColor = vec4(col, 1.0);
    }
`;

const lavaVertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    uniform float time;
    void main() {
        vUv = uv;
        vPosition = position;
        vec3 pos = position;
        pos.y += sin(time * 2.0 + pos.x * 5.0) * 0.1; // Wavy displacement
        pos.x += cos(time * 3.0 + pos.z * 3.0) * 0.05;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const lavaFragmentShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    uniform float time;
    uniform vec3 baseColor;
    void main() {
        vec3 col = baseColor;
        col.r += sin(time * 4.0 + vUv.x * 10.0) * 0.3; // Red flicker
        col.g += cos(time * 3.0 + vUv.y * 8.0) * 0.2; // Orange wave
        col.b += sin(time * 5.0) * 0.1; // Slight blue for heat
        gl_FragColor = vec4(col, 1.0);
    }
`;

// --- REFERENCIAS GLOBALES ---
var renderer, scene, camera, planeta, previousRadial, cube;
let sunLight;
var clock = new THREE.Clock();

// --- GESTIÓN DE ANIMACIÓN ---
var mixer;
const actions = {}; 
let activeAction; 

// --- ESTADO DEL JUEGO ---
let gameRunning = true;
let gameTime = 0;
let score = 0;
let hits = 0;
const MAX_HITS = 3;
let obstacles = [];
let staticObstacles = [];
let lavaSpots = [];
let explosions = [];
let powerUps = [];
let enemies = [];
let bestScore = localStorage.getItem('bestScore') || 0;

// Auto shrink
let lastAutoShrinkTime = 0;
const AUTO_SHRINK_INTERVAL = 10;

// Shrinking animation
let isShrinking = false;
let shrinkStartTime = 0;
let shrinkDuration = 1.0;
let shrinkStartRadius = 0;
let shrinkTargetRadius = 0;

// Invulnerabilidad
let invulnerable = false;
let invulnTimer = 0;
const INVULN_DURATION = 3;

// Daño de lava
let inLava = false;
let lavaDamageTimer = 0;
const LAVA_DAMAGE_INTERVAL = 0.3;

// Seguimiento de carga de modelos
const modelsToLoad = 8; // player model + 2 anims + 3 enemies + tree + meteor/lava
let modelsLoaded = 0;
let isInitialized = false;

// Meteor/Lava model template
let meteorLavaTemplate;
let treeTemplate; // Global for regeneration

// Player initial position
const playerInitialPos = new THREE.Vector3(0, 40 + 0.5, 0);

// --- CONSTANTES DE CONFIGURACIÓN ---
const originalPlanetRadius = 40;
let currentPlanetRadius = originalPlanetRadius;
const CHARACTER_HEIGHT = 0.5;
const CHARACTER_SCALE = 0.02;
const FORWARD_SPEED = 8.0;
const TURN_SPEED = 2.0;
const CAMERA_DISTANCE = 1000;
const CAMERA_HEIGHT = 700;
const STATIC_COLLISION_DISTANCE = 0.8;
const TREE_COLLISION_DISTANCE = 5;
const SHRINK_AMOUNT = 5.0;
const WIN_RADIUS = 10.0;
const BLAST_DAMAGE_RADIUS = 3.0;

// --- CONFIGURACIÓN DE OBSTÁCULOS MEJORADA ---
let METEOR_SPAWN_RATE = 0.015;
const METEOR_SPEED = 35;
const METEOR_RADIUS = 1;
const EXPLOSION_RADIUS = 5;
const EXPLOSION_DURATION = 1;
const COLLISION_DISTANCE = 2.0;
let POWERUP_SPAWN_RATE = 0.005;
const POWERUP_RADIUS = 0.5;
const SCORE_PER_SECOND = 10;
const SCORE_PER_POWERUP = 100;
const SCORE_PER_ENEMY = 50;
const DIFFICULTY_INCREASE_INTERVAL = 8;
let lastDifficultyIncrease = 0;
let lastSecond = 0;

let ENEMY_SPAWN_RATE = 0.008;
const ENEMY_SPEED = 2.0;
const ENEMY_RADIUS = 0.8;
const ENEMY_TYPES = [
    { name: 'chaser', model: 'models/e1.glb', scale: 1.0, color: 0xff00ff, speed: 2.0, behavior: 'chase' },
    { name: 'brute', model: 'models/e2.glb', scale: 0.8, color: 0xff00ff, speed: 1.2, behavior: 'chase' },
    { name: 'jumper', model: 'models/e3.glb', scale: 1.2, color: 0xff00ff, speed: 1.6, behavior: 'jump' }
];

// Cache de modelos de enemigos
const enemyModels = {};

// Minimap
let minimapRenderer, minimapCamera;
let minimapAngle = 0;
let stoneTexture;

// --- ESTADO DEL TECLADO ---
var keysPressed = {};
document.addEventListener('keydown', (event) => {
    keysPressed[event.key.toLowerCase()] = true;
}, false);
document.addEventListener('keyup', (event) => keysPressed[event.key.toLowerCase()] = false, false);

let personaje;

// GUI Controls
var controls = {
  planetRadius: originalPlanetRadius,
  numTrees: 100,
  meteorSpawnRate: METEOR_SPAWN_RATE,
  enemySpawnRate: ENEMY_SPAWN_RATE,
  powerupSpawnRate: POWERUP_SPAWN_RATE,
  forwardSpeed: FORWARD_SPEED
};

init();
loadPlaneta(originalPlanetRadius, 'images/planet.png');
loadPersonaje('models/c.fbx', CHARACTER_SCALE);
preloadEnemyModels();
loadMeteorLavaModel();
render();

function modelLoaded() {
    modelsLoaded++;
    if (modelsLoaded === modelsToLoad) {
        isInitialized = true;
        document.getElementById('loading').style.display = 'none';
        console.log('All models loaded');
    }
}

function regenerateTrees(num) {
  // Remove existing trees
  staticObstacles.forEach(tree => scene.remove(tree));
  staticObstacles = [];

  if (!treeTemplate) {
    createProceduralTrees(currentPlanetRadius, num);
    return;
  }

  let placedTrees = 0;
  const radio = currentPlanetRadius;
  while (placedTrees < num) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const pos = new THREE.Vector3(
      radio * Math.sin(phi) * Math.cos(theta),
      radio * Math.sin(phi) * Math.sin(theta),
      radio * Math.cos(phi)
    );
    const distToPlayer = pos.distanceTo(playerInitialPos);
    if (distToPlayer < 10) continue;

    const tree = treeTemplate.clone();
    tree.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    const scaleFactor = 2 + Math.random() * 3;
    tree.scale.set(scaleFactor, scaleFactor, scaleFactor);
    tree.position.copy(pos);
    const radial = pos.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial);
    tree.quaternion.copy(quat);
    tree.castShadow = true;
    tree.receiveShadow = true;

    const treeOffset = CHARACTER_HEIGHT + scaleFactor * 1.333;
    tree.position.add(radial.clone().multiplyScalar(treeOffset));
    tree.userData = {
      isTree: true,
      radial: radial.clone(),
      offset: treeOffset
    };
    scene.add(tree);
    staticObstacles.push(tree);
    placedTrees++;
  }
  console.log(`${num} trees regenerated`);
}

function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(new THREE.Color(0x000011));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.getElementById('container').appendChild(renderer.domElement);

    // Minimap setup mejorado
    const minimapDiv = document.getElementById('minimap');
    minimapRenderer = new THREE.WebGLRenderer({ antialias: false });
    minimapRenderer.setSize(150, 150);
    minimapRenderer.setClearColor(0x000022);
    minimapRenderer.shadowMap.enabled = false;
    minimapDiv.appendChild(minimapRenderer.domElement);

    minimapCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    minimapCamera.position.set(0, 0, originalPlanetRadius * 3);
    minimapCamera.lookAt(0, 0, 0);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    
    camera.position.set(0, originalPlanetRadius + CAMERA_HEIGHT + 10, 20);
    camera.lookAt(0, originalPlanetRadius, 0);
    
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 30000;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const colors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 800 + Math.random() * 1200;
        positions[i3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = r * Math.cos(phi);
        
        sizes[i] = Math.random() * 4 + 1;
        
        const color = new THREE.Color();
        color.setHSL(Math.random() * 0.1 + 0.55, 0.7, Math.random() * 0.3 + 0.7);
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const starMaterial = new THREE.PointsMaterial({ 
        size: 3, 
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true 
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    
    scene.add(new THREE.AmbientLight(0x404040, 0.6));
    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x444444, 1.0);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);
    
    sunLight = new THREE.DirectionalLight(0xffddaa, 2.0);
    sunLight.position.set(200, 150, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 1000;
    sunLight.shadow.camera.left = -originalPlanetRadius * 3;
    sunLight.shadow.camera.right = originalPlanetRadius * 3;
    sunLight.shadow.camera.top = originalPlanetRadius * 3;
    sunLight.shadow.camera.bottom = -originalPlanetRadius * 3;
    sunLight.shadow.bias = -0.0001;
    sunLight.shadow.normalBias = 0.0005;
    scene.add(sunLight);

    // Luz de relleno suave para evitar sombras duras, sin blanco puro
    const fillLight = new THREE.DirectionalLight(0xddddff, 0.8); // Tono azulado suave
    fillLight.position.set(-200, -150, -100);
    fillLight.castShadow = false;
    scene.add(fillLight);

    // Sol
    const sunGeometry = new THREE.SphereGeometry(8, 64, 64);
    const sunMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffddaa,
        transparent: true,
        opacity: 0.95
    });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.copy(sunLight.position);
    scene.add(sun);

    const glowGeometry = new THREE.SphereGeometry(25, 64, 64);
    const glowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffaa00, 
        transparent: true, 
        opacity: 0.4,
        side: THREE.BackSide 
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(sunLight.position);
    scene.add(glow);

    const haloGeometry = new THREE.TorusGeometry(30, 2, 16, 100);
    const haloMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.3 
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.position.copy(sunLight.position);
    halo.rotation.x = Math.PI / 2;
    scene.add(halo);

    function animateHalo() {
        if (halo) halo.rotation.z += 0.005;
        requestAnimationFrame(animateHalo);
    }
    animateHalo();

    const sunPointLight = new THREE.PointLight(0xffddaa, 1.0, 300);
    sunPointLight.position.copy(sunLight.position);
    scene.add(sunPointLight);

    const planetPointLight = new THREE.PointLight(0xaaaaaa, 0.5, 100);
    planetPointLight.position.set(0, 0, 0);
    scene.add(planetPointLight);

    const snowGeometry = new THREE.BufferGeometry();
    const snowCount = 5000;
    const snowPositions = new Float32Array(snowCount * 3);
    const snowVelocities = new Float32Array(snowCount * 3);
    const snowColors = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
        const i3 = i * 3;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = originalPlanetRadius * (1 + Math.random() * 0.2);
        snowPositions[i3] = r * Math.sin(phi) * Math.cos(theta);
        snowPositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        snowPositions[i3 + 2] = r * Math.cos(phi);
        
        // Velocity towards center for falling snow
        const dir = new THREE.Vector3(snowPositions[i3], snowPositions[i3+1], snowPositions[i3+2]).normalize();
        const speed = 0.5 + Math.random() * 1.0;
        snowVelocities[i3] = -dir.x * speed;
        snowVelocities[i3 + 1] = -dir.y * speed;
        snowVelocities[i3 + 2] = -dir.z * speed;
        
        snowColors[i3] = 0.9 + Math.random() * 0.1;
        snowColors[i3 + 1] = 0.9 + Math.random() * 0.1;
        snowColors[i3 + 2] = 0.8 + Math.random() * 0.2;
    }
    snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    snowGeometry.setAttribute('velocity', new THREE.BufferAttribute(snowVelocities, 3));
    snowGeometry.setAttribute('color', new THREE.BufferAttribute(snowColors, 3));
    const snowMaterial = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true
    });
    const snow = new THREE.Points(snowGeometry, snowMaterial);
    scene.add(snow);
    window.snow = snow;

    const textureLoader = new THREE.TextureLoader();
    stoneTexture = textureLoader.load('https://threejs.org/examples/textures/brick_diffuse.jpg');
    window.addEventListener('resize', updateAspectRatio);

    // GUI Setup
    var gui = new dat.GUI({ autoPlace: false });
    document.body.appendChild(gui.domElement);
    gui.domElement.style.position = 'fixed';
    gui.domElement.style.bottom = '5%';         // Margen inferior de 10px
    gui.domElement.style.right = '10px';        // Margen derecho de 10px
    gui.domElement.style.zIndex = '1000';       // Encima de otros elementos

    // Planet Folder
    var guiPlanet = gui.addFolder('Planet');
    guiPlanet.add(controls, 'planetRadius', WIN_RADIUS, 100).name("Radius").onChange(function(value) {
      currentPlanetRadius = value;
      planeta.scale.setScalar(value / originalPlanetRadius);
      // Update static obstacles positions
      for (let obj of staticObstacles) {
        if (obj.userData && obj.userData.isTree) {
          const targetDist = value + obj.userData.offset;
          obj.position.copy(obj.userData.radial.clone().multiplyScalar(targetDist));
        }
      }
      // Update shadow camera
      if (sunLight && sunLight.shadow && sunLight.shadow.camera) {
        const shadowSize = value * 3;
        const shadowCamera = sunLight.shadow.camera;
        shadowCamera.left = -shadowSize;
        shadowCamera.right = shadowSize;
        shadowCamera.top = shadowSize;
        shadowCamera.bottom = -shadowSize;
        shadowCamera.updateProjectionMatrix();
      }
    });
    guiPlanet.add(controls, 'numTrees', 50, 200).name("Num Trees").onChange(regenerateTrees);
    guiPlanet.open();

    // Spawn Rates Folder
    var guiSpawn = gui.addFolder('Spawn Rates');
    guiSpawn.add(controls, 'meteorSpawnRate', 0, 10.0).name("Meteor Rate").onChange(function(value) {
      METEOR_SPAWN_RATE = value;
    });
    guiSpawn.add(controls, 'enemySpawnRate', 0, 1.00).name("Enemy Rate").onChange(function(value) {
      ENEMY_SPAWN_RATE = value;
    });
    guiSpawn.add(controls, 'powerupSpawnRate', 0, 1.00).name("Powerup Rate").onChange(function(value) {
      POWERUP_SPAWN_RATE = value;
    });
    guiSpawn.open();

    setInterval(updateUI, 100);
}

function loadMeteorLavaModel() {
    const loader = new THREE.GLTFLoader();
    loader.load('models/a.glb', function(gltf) {
        meteorLavaTemplate = gltf.scene.clone();
        meteorLavaTemplate.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        console.log('Meteor/Lava model loaded');
        modelLoaded();
    }, undefined, function(error) {
        console.error('Error loading meteor/lava model:', error);
        // Fallback: create a simple geometry for both
        const fallbackGeo = new THREE.DodecahedronGeometry(1, 1);
        const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const fallbackModel = new THREE.Mesh(fallbackGeo, fallbackMat);
        fallbackModel.userData.fallback = true;
        meteorLavaTemplate = fallbackModel;
        console.log('Fallback created for meteor/lava');
        modelLoaded();
    });
}

function loadPlaneta(radio, texturaURL) {
    const geometria = new THREE.SphereGeometry(radio, 128, 128);
    const textura = new THREE.TextureLoader().load(texturaURL);
    const material = new THREE.MeshStandardMaterial({ 
        map: textura,
        normalMap: textura,
        normalScale: new THREE.Vector2(0.5, 0.5),
        metalness: 0.05,
        roughness: 0.9
    });
    planeta = new THREE.Mesh(geometria, material);
    planeta.receiveShadow = true;
    planeta.castShadow = true;
    planeta.userData.originalRadius = radio;
    scene.add(planeta);

    planeta.userData.originalScale = 1.0;

    // Load tree model instead of procedural
    const treeLoader = new THREE.GLTFLoader();
    treeLoader.load('models/tree.glb', function(gltf) {
        treeTemplate = gltf.scene.clone();
        treeTemplate.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        treeTemplate.scale.set(3, 3, 3);

        const numTrees = controls.numTrees;
        let placedTrees = 0;
        while (placedTrees < numTrees) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const pos = new THREE.Vector3(
                radio * Math.sin(phi) * Math.cos(theta),
                radio * Math.sin(phi) * Math.sin(theta),
                radio * Math.cos(phi)
            );
            const distToPlayer = pos.distanceTo(playerInitialPos);
            if (distToPlayer < 10) continue;

            const tree = treeTemplate.clone();
            tree.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            const scaleFactor = 2 + Math.random() * 3; // Random scale between 2 and 5
            tree.scale.set(scaleFactor, scaleFactor, scaleFactor);
            tree.position.copy(pos);
            const radial = pos.clone().normalize();
            const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial);
            tree.quaternion.copy(quat);
            tree.castShadow = true;
            tree.receiveShadow = true;

            const treeOffset = CHARACTER_HEIGHT + scaleFactor * 1.333; // Adjusted offset based on scale (approx 4/3 for base 3)
            tree.position.add(radial.clone().multiplyScalar(treeOffset));
            tree.userData = {
                isTree: true,
                radial: radial.clone(),
                offset: treeOffset
            };
            scene.add(tree);
            staticObstacles.push(tree);
            placedTrees++;
        }
        console.log('Trees loaded from GLTF');
        modelLoaded();
    }, undefined, function(error) {
        console.error('Error loading tree model:', error);
        createProceduralTrees(radio, controls.numTrees);
    });
}

function createProceduralTrees(radio, num = 100) {
    // Fallback procedural trees
    const numTrees = num;
    let placedTrees = 0;
    while (placedTrees < numTrees) {
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        const foliageGeo = new THREE.SphereGeometry(1.5, 8, 8);
        const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = 1.5;
        const tree = new THREE.Group();
        tree.add(trunk);
        tree.add(foliage);

        const scaleFactor = 2 + Math.random() * 3; // Random scale between 2 and 5
        tree.scale.set(scaleFactor, scaleFactor, scaleFactor);

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const pos = new THREE.Vector3(
            radio * Math.sin(phi) * Math.cos(theta),
            radio * Math.sin(phi) * Math.sin(theta),
            radio * Math.cos(phi)
        );
        const distToPlayer = pos.distanceTo(playerInitialPos);
        if (distToPlayer < 10) continue; // Skip if too close

        tree.position.copy(pos);
        const radial = pos.clone().normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial);
        tree.quaternion.copy(quat);
        const treeOffset = CHARACTER_HEIGHT + scaleFactor * 1.333; // Adjusted offset based on scale
        tree.position.add(radial.clone().multiplyScalar(treeOffset));
        tree.userData = {
            isTree: true,
            radial: radial.clone(),
            offset: treeOffset
        };
        tree.castShadow = true;
        tree.receiveShadow = true;
        scene.add(tree);
        staticObstacles.push(tree);
        placedTrees++;
    }
    modelLoaded();
}

function spawnLava(position) {
    const lavaRadius = 1.0 + Math.random() * 0.3; 
    const lavaGeometry = new THREE.IcosahedronGeometry(lavaRadius, 3);
    const lavaMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 },
            baseColor: { value: new THREE.Color(0xff4500) }
        },
        vertexShader: lavaVertexShader,
        fragmentShader: lavaFragmentShader,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
    });
    const lava = new THREE.Mesh(lavaGeometry, lavaMaterial);
    lava.castShadow = true;
    lava.receiveShadow = true;

    const radial = position.clone().normalize();
    lava.position.copy(position);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial);
    lava.quaternion.copy(quat);

    scene.add(lava);
    lavaSpots.push(lava);
    lava.userData.originalPosition = position.clone().multiplyScalar(originalPlanetRadius / currentPlanetRadius);
    lava.userData.pulseTime = Math.random() * Math.PI * 2;

    // Partículas de humo
    for (let s = 0; s < 3; s++) {
        const smokeGeo = new THREE.SphereGeometry(0.3, 4, 4);
        const smokeMat = new THREE.MeshBasicMaterial({
            color: 0x222222,
            transparent: true,
            opacity: 0.4
        });
        const smoke = new THREE.Mesh(smokeGeo, smokeMat);
        smoke.position.copy(lava.position);
        smoke.position.add(new THREE.Vector3(
            (Math.random() - 0.5) * lavaRadius,
            lavaRadius + 0.5 + Math.random(),
            (Math.random() - 0.5) * lavaRadius
        ));
        scene.add(smoke);
        lava.userData.smokes = lava.userData.smokes || [];
        lava.userData.smokes.push(smoke);
    }
}

// --- SPAWN DE ENEMIGOS VARIADOS ---
function preloadEnemyModels() {
    const loader = new THREE.GLTFLoader();
    ENEMY_TYPES.forEach(type => {
        loader.load(type.model, function(gltf) {
            const model = gltf.scene.clone();
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        child.material = child.material.clone();
                        child.material.color.set(type.color);
                        child.material.emissive = new THREE.Color(type.color);
                        child.material.emissiveIntensity = 0.3;
                        child.material.metalness = 1.0;
                        child.material.roughness = 0.1;
                        child.material.transparent = true;
                        child.material.opacity = 0.7;
                    }
                }
            });
            enemyModels[type.name] = model;
            console.log(`Modelo de enemigo ${type.name} cargado`);
            modelLoaded();
        }, undefined, function(error) {
            console.error(`Error cargando modelo ${type.model}:`, error);
            const fallbackGeometry = type.name === 'chaser' ? 
                new THREE.SphereGeometry(0.5, 8, 8) :
                (type.name === 'brute' ? 
                    new THREE.CylinderGeometry(0.6, 0.8, 1.2, 8) :
                    new THREE.ConeGeometry(0.4, 1.5, 8)
                );
            const fallbackMaterial = new THREE.ShaderMaterial({ 
                uniforms: {
                    time: { value: 0.0 },
                    baseColor: { value: new THREE.Color(type.color) }
                },
                vertexShader: glitchVertexShader,
                fragmentShader: glitchFragmentShader,
                transparent: true,
                opacity: 0.7
            });
            const fallbackModel = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
            fallbackModel.userData = { fallback: true };
            enemyModels[type.name] = fallbackModel;
            console.log(`Fallback procedural creado para enemigo ${type.name}`);
            modelLoaded();
        });
    });
}

function spawnEnemy(effectiveRadius) {
    if (!gameRunning || !isInitialized || Math.random() > ENEMY_SPAWN_RATE) return;

    if (lavaSpots.length === 0) return; // No lava, no spawn

    const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    const modelTemplate = enemyModels[type.name];
    if (!modelTemplate) return;

    // Spawn from random lava
    const randomLava = lavaSpots[Math.floor(Math.random() * lavaSpots.length)];
    const lavaPos = randomLava.position.clone();

    let enemy;
    if (true) {  // Cambia a false para usar modelo real
        const geo = new THREE.SphereGeometry(0.5, 8, 8);
        const enemyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0.0 },
                baseColor: { value: new THREE.Color(type.color) }
            },
            vertexShader: glitchVertexShader,
            fragmentShader: glitchFragmentShader,
            transparent: true,
            opacity: 0.7
        });
        enemy = new THREE.Mesh(geo, enemyMaterial);
        enemy.userData.fallback = true;
        console.log(`Usando fallback para ${type.name}`);
    } else {
        enemy = modelTemplate.clone();
    }

    enemy.scale.set(type.scale, type.scale, type.scale);

    const radial = lavaPos.clone().normalize();
    const height = CHARACTER_HEIGHT;
    const spawnRadius = effectiveRadius * 1.0 + height;
    const pos = radial.clone().multiplyScalar(spawnRadius);
    pos.add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2)); // Small offset

    enemy.position.copy(pos);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial);
    enemy.quaternion.copy(quat);
    enemy.userData = { 
        radial: radial.clone(), 
        speed: type.speed * 2.5,
        behavior: type.behavior,
        type: type.name,
        height: height,
        isEnemy: true,
        rotationSpeed: Math.random() * 0.5 + 0.5,
        shapeTime: Math.random() * Math.PI * 2
    };
    
    enemy.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
                child.material.emissiveIntensity = 0.8;
                child.material.metalness = 1.0;
                child.material.roughness = 0.1;
                child.material.transparent = true;
                child.material.opacity = 0.7;
            }
        }
    });

    scene.add(enemy);
    enemies.push(enemy);

    const trailPoints = [enemy.position.clone()];
    for (let j = 1; j < 8; j++) {
        const backPos = enemy.position.clone().sub(radial.clone().multiplyScalar(j * 1));
        trailPoints.push(backPos);
    }
    const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
    const trailMaterial = new THREE.LineBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.6 });
    const trail = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(trail);
    enemy.userData.trail = trail;

    console.log(`Enemigo ${type.name} spawn from lava en posición:`, pos);
}

function loadPersonaje(url, scale = 1.0) {
    const loader = new THREE.FBXLoader();
    loader.load(url, function(fbx) {
        personaje = fbx;
        personaje.scale.set(scale, scale, scale);
        const initialPos = playerInitialPos.clone();
        personaje.position.copy(initialPos);
        
        const initialRadial = initialPos.clone().normalize();
        const quatUp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), initialRadial);
        const initialYaw = 0;
        const quatYaw = new THREE.Quaternion().setFromAxisAngle(initialRadial, initialYaw);
        const quat = quatUp.clone();
        quat.premultiply(quatYaw);
        personaje.quaternion.copy(quat);
        
        previousRadial = initialRadial.clone();
        
        personaje.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    child.material.metalness = 0.3;
                    child.material.roughness = 0.4;
                }
            }
        });
        
        scene.add(personaje);

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(personaje.quaternion);
        forward.projectOnPlane(initialRadial).normalize();
        mixer = new THREE.AnimationMixer(personaje);

        // Cargar animaciones
        loadAnimation('models/still.fbx', 'Idle');
        loadAnimation('models/run.fbx', 'Walk');

        console.log('Personaje cargado correctamente.');
        modelLoaded(); // Incrementar por el modelo del personaje
    }, undefined, function(error) {
        console.error('Error al cargar el modelo:', error);
        modelLoaded(); // Incrementar incluso en error
    });
}

function loadAnimation(file, name) {
    const animLoader = new THREE.FBXLoader();
    animLoader.load(file, function(animFbx) {
        const clip = animFbx.animations[0];
        if (clip) {
            actions[name] = mixer.clipAction(clip);
            if (name === 'Idle') {
                actions[name].setLoop(THREE.LoopRepeat, Infinity);
                setActiveAction(actions[name]);
            } else if (name === 'Walk') {
                actions[name].setLoop(THREE.LoopRepeat, Infinity);
            }
            console.log(`${name} animation loaded`);
        }
        modelLoaded(); // Incrementar por cada animación
    }, undefined, function(error) {
        console.error(`Error loading ${name} animation:`, error);
        modelLoaded(); // Incrementar incluso en error
    });
}

function setActiveAction(actionToActivate) {
    if (activeAction === actionToActivate) return;
    if (activeAction) activeAction.fadeOut(0.3);
    
    actionToActivate.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.3).play();
    activeAction = actionToActivate;
}

function updateAspectRatio() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function updateUI() {
    if (!gameRunning) return;
    document.getElementById('time').textContent = Math.floor(gameTime);
    document.getElementById('score').textContent = Math.floor(score);
    document.getElementById('hits').textContent = hits;
    document.getElementById('healthFill').style.width = ((MAX_HITS - hits) / MAX_HITS * 100) + '%';
    document.getElementById('planetRadius').textContent = Math.floor(currentPlanetRadius);

    // Indicadores informativos
    const invulnEl = document.getElementById('invulnIndicator');
    const lavaEl = document.getElementById('lavaWarning');
    if (invulnerable) {
        invulnEl.style.display = 'block';
    } else {
        invulnEl.style.display = 'none';
    }
    if (inLava) {
        lavaEl.style.display = 'block';
    } else {
        lavaEl.style.display = 'none';
    }
}

function winGame() {
    gameRunning = false;
    document.getElementById('winTime').textContent = Math.floor(gameTime);
    document.getElementById('winScore').textContent = Math.floor(score);
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('bestScore', bestScore);
    }
    document.getElementById('winScreen').style.display = 'block';
}

function endGame() {
    gameRunning = false;
    document.getElementById('finalTime').textContent = Math.floor(gameTime);
    document.getElementById('finalScore').textContent = Math.floor(score);
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('bestScore', bestScore);
    }
    document.getElementById('bestScore').textContent = Math.floor(bestScore);
    document.getElementById('gameOver').style.display = 'block';
}

// --- SPAWN DE METEORITOS CON TRAIL MEJORADO ---
function spawnMeteor(effectiveRadius) {
    if (!isInitialized || !gameRunning || Math.random() > METEOR_SPAWN_RATE || !meteorLavaTemplate) return;

    const spawnRadius = effectiveRadius * 5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = spawnRadius * Math.sin(phi) * Math.cos(theta);
    const y = spawnRadius * Math.sin(phi) * Math.sin(theta);
    const z = spawnRadius * Math.cos(phi);

    const meteor = meteorLavaTemplate.clone();
    meteor.scale.set(METEOR_RADIUS, METEOR_RADIUS, METEOR_RADIUS);
    meteor.traverse((child) => {
        if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({ 
                color: 0x8B4513,
                emissive: 0xFF4500,
                emissiveIntensity: 0.5
            });
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    meteor.position.set(x, y, z);
    const direction = new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), meteor.position).normalize();
    meteor.userData = { direction: direction, speed: METEOR_SPEED, isMeteor: true };

    const trailPoints = [];
    for (let j = 0; j < 15; j++) {
        trailPoints.push(meteor.position.clone().add(direction.clone().multiplyScalar(-j * 2)));
    }
    const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
    const trailMaterial = new THREE.LineBasicMaterial({ 
        color: 0xFF4500, 
        transparent: true, 
        opacity: 0.7,
        linewidth: 2
    });
    const trail = new THREE.Line(trailGeometry, trailMaterial);
    meteor.userData.trail = trail;
    scene.add(trail);

    scene.add(meteor);
    obstacles.push(meteor);
}

// --- SPAWN DE POWER-UPS MEJORADO ---
function spawnPowerUp(effectiveRadius) {
    if (!isInitialized || !gameRunning || Math.random() > POWERUP_SPAWN_RATE) return;

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const pos = new THREE.Vector3(
        effectiveRadius * Math.sin(phi) * Math.cos(theta),
        effectiveRadius * Math.sin(phi) * Math.sin(theta),
        effectiveRadius * Math.cos(phi)
    );

    const powerUpGeometry = new THREE.OctahedronGeometry(POWERUP_RADIUS, 0);
    const powerUpMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.8,
        roughness: 0.2
    });
    const powerUp = new THREE.Mesh(powerUpGeometry, powerUpMaterial);
    powerUp.position.copy(pos);
    powerUp.userData.originalPosition = pos.clone().multiplyScalar(originalPlanetRadius / effectiveRadius);
    const radial = pos.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial);
    powerUp.quaternion.copy(quat);
    powerUp.userData = { ...powerUp.userData, isPowerUp: true };
    scene.add(powerUp);
    powerUps.push(powerUp);
}

function updateObstacles(deltaTime, effectiveRadius) {
    const currentTime = clock.getElapsedTime();
    for (let lava of lavaSpots) {
        if (lava.material && lava.material.uniforms && lava.material.uniforms.time) {
            lava.material.uniforms.time.value = currentTime;
        }
        lava.userData.pulseTime += deltaTime * 2;
        lava.scale.setScalar(1 + Math.sin(lava.userData.pulseTime) * 0.2);
        if (lava.userData.smokes) {
            lava.userData.smokes.forEach((smoke, index) => {
                smoke.position.y += Math.sin(clock.getElapsedTime() * 2 + index) * 0.02;
                smoke.rotation.y += deltaTime * 1;
                smoke.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 3 + index) * 0.1);
            });
        }
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        if (obs.userData.isMeteor) {
            if (obs.userData.trail) {
                const points = obs.userData.trail.geometry.attributes.position.array;
                const dir = obs.userData.direction;
                for (let j = 0; j < points.length; j += 3) {
                    const dist = j / 3 * 2;
                    points[j] = obs.position.x - dir.x * dist;
                    points[j+1] = obs.position.y - dir.y * dist;
                    points[j+2] = obs.position.z - dir.z * dist;
                }
                obs.userData.trail.geometry.attributes.position.needsUpdate = true;
            }

            obs.position.add(obs.userData.direction.clone().multiplyScalar(obs.userData.speed * deltaTime));
            
            if (obs.position.length() <= effectiveRadius + METEOR_RADIUS) {
                const impactPos = obs.position.clone().normalize().multiplyScalar(effectiveRadius);
                createExplosion(impactPos);
                spawnLava(impactPos);
                if (obs.userData.trail) scene.remove(obs.userData.trail);
                scene.remove(obs);
                obstacles.splice(i, 1);
                continue;
            }
        }
    }

    for (let pu of powerUps) {
        pu.rotation.y += deltaTime * 4;
        pu.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 5) * 0.3);
    }

    if (personaje) {
        const playerPos = personaje.position.clone();
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.material && enemy.material.uniforms && enemy.material.uniforms.time) {
                enemy.material.uniforms.time.value = currentTime;
            }
            const enemyPos = enemy.position.clone();
            const radial = enemyPos.clone().normalize();

            let direction;
            if (enemy.userData.behavior === 'chase' || enemy.userData.behavior === 'jump') {
                direction = playerPos.clone().sub(enemyPos).normalize();
                direction.projectOnPlane(radial);
                if (direction.length() < 0.01) {
                    direction = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                    direction.projectOnPlane(radial);
                }
                direction.normalize();
            }

            const moveVec = direction.clone().multiplyScalar(enemy.userData.speed * deltaTime);
            const newPos = enemyPos.clone().add(moveVec).normalize().multiplyScalar(effectiveRadius + enemy.userData.height);

            enemy.position.copy(newPos);
            const newRadial = newPos.clone().normalize();
            if (!enemy.userData.radial.equals(newRadial)) {
                const correction = new THREE.Quaternion().setFromUnitVectors(enemy.userData.radial, newRadial);
                enemy.quaternion.premultiply(correction);
                enemy.userData.radial.copy(newRadial);
            }

            enemy.rotation.y += deltaTime * (2 + Math.random());

            if (enemy.userData.fallback || true) {
                enemy.rotation.x += deltaTime * enemy.userData.rotationSpeed * 0.8;
                enemy.rotation.z += Math.sin(gameTime * 3 + i) * deltaTime * 0.3;  // Bobbing más rápido
                enemy.userData.shapeTime += deltaTime * 3;
                const shapeScale = 1 + Math.sin(enemy.userData.shapeTime) * 0.3;
                enemy.scale.setScalar(shapeScale);
                if (enemy.userData.trail) {
                    const points = enemy.userData.trail.geometry.attributes.position.array;
                    points[0] = enemy.position.x; points[1] = enemy.position.y; points[2] = enemy.position.z;
                    for (let j = 1; j < points.length / 3; j++) {
                        const dist = j * 1;
                        points[j*3] = enemy.position.x - radial.x * dist;
                        points[j*3+1] = enemy.position.y - radial.y * dist;
                        points[j*3+2] = enemy.position.z - radial.z * dist;
                    }
                    enemy.userData.trail.geometry.attributes.position.needsUpdate = true;
                }
            }
        }
    }
}

function createExplosion(position) {
    const explosionGeometry = new THREE.SphereGeometry(EXPLOSION_RADIUS, 32, 32);
    const explosionMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFF4500, 
        transparent: true, 
        opacity: 0.9 
    });
    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);

    explosion.position.copy(position);
    explosion.userData = { 
        startTime: clock.getElapsedTime(), 
        duration: EXPLOSION_DURATION, 
        isExplosion: true 
    };

    scene.add(explosion);
    explosions.push(explosion);

    for (let k = 0; k < 30; k++) {
        const particleGeo = new THREE.SphereGeometry(0.1, 4, 4);
        const particleMat = new THREE.MeshBasicMaterial({
            color: 0xFF6600,
            transparent: true,
            opacity: 1
        });
        const particle = new THREE.Mesh(particleGeo, particleMat);
        particle.position.copy(position);
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        particle.userData = { velocity: dir.multiplyScalar(15), life: 1.5 }; // Velocidad y vida aumentadas
        scene.add(particle);
        explosions.push(particle);
    }
}

// --- DETECCIÓN DE COLISIONES ESTÁTICAS ---
function checkStaticCollisions(newPos) {
    for (let staticObj of staticObstacles) {
        let collisionDist = STATIC_COLLISION_DISTANCE;
        if (staticObj.userData && staticObj.userData.isTree) {
            collisionDist = TREE_COLLISION_DISTANCE;
        }
        const dist = newPos.distanceTo(staticObj.position);
        if (dist < collisionDist) {
            return true;
        }
    }
    return false;
}

function checkCollisions(deltaTime) {
    if (!personaje || !gameRunning || !isInitialized) return;

    const characterPos = personaje.position;

    // Colisión con meteoritos
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        if (obs.userData.isMeteor) {
            const dist = characterPos.distanceTo(obs.position);
            if (dist < COLLISION_DISTANCE && !invulnerable) {
                takeHit();
                createExplosion(obs.position);
                if (obs.userData.trail) scene.remove(obs.userData.trail);
                scene.remove(obs);
                obstacles.splice(i, 1);
            }
        }
    }

    // Colisión con explosiones
    for (let i = explosions.length - 1; i >= 0; i--) {
        const exp = explosions[i];
        if (exp.userData.isExplosion && exp.geometry.parameters.radius === EXPLOSION_RADIUS) {
            const dist = characterPos.distanceTo(exp.position);
            if (dist < BLAST_DAMAGE_RADIUS && !invulnerable) {
                takeHit();
            }
        }
    }

    // Colisión con power-ups (distancia aumentada)
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const pu = powerUps[i];
        const dist = characterPos.distanceTo(pu.position);
        if (dist < COLLISION_DISTANCE + 0.5) {
            heal();
            score += SCORE_PER_POWERUP;
            scene.remove(pu);
            powerUps.splice(i, 1);
        }
    }

    // Colisión con enemigos
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const dist = characterPos.distanceTo(enemy.position);
        if (dist < COLLISION_DISTANCE && !invulnerable) {
            takeHit();
            score += SCORE_PER_ENEMY;
            if (enemy.userData.trail) scene.remove(enemy.userData.trail);
            scene.remove(enemy);
            enemies.splice(i, 1);
        }
    }

    if (!lavaSpots || lavaSpots.length === 0) return;
    let inLavaNow = false;
    for (let lava of lavaSpots) {
        if (lava && lava.position && characterPos.distanceTo(lava.position) < 1.5) {
            inLavaNow = true;
            break;
        }
    }
    if (inLavaNow && !inLava) {
        lavaDamageTimer = 0;
    }
    inLava = inLavaNow;
    if (inLava && !invulnerable) {
        lavaDamageTimer += deltaTime;
        if (lavaDamageTimer >= LAVA_DAMAGE_INTERVAL) {
            takeHit();
            lavaDamageTimer = 0;
        }
    }
}

function takeHit() {
    if (!gameRunning) return;
    hits++;
    document.getElementById('hits').textContent = hits;
    invulnerable = true;
    invulnTimer = INVULN_DURATION;
    if (hits >= MAX_HITS) {
        endGame();
    }
}

function heal() {
    if (hits > 0) {
        hits--;
        document.getElementById('hits').textContent = hits;
    }
}

function update() {
    const deltaTime = clock.getDelta();
    let effectiveRadius = currentPlanetRadius;
    if (gameRunning && isInitialized) {
        gameTime += deltaTime;
        score += SCORE_PER_SECOND * deltaTime;

        // Auto shrink trigger
        if (gameTime - lastAutoShrinkTime >= AUTO_SHRINK_INTERVAL && !isShrinking) {
            isShrinking = true;
            shrinkStartTime = gameTime;
            shrinkStartRadius = currentPlanetRadius;
            shrinkTargetRadius = Math.max(WIN_RADIUS, currentPlanetRadius - SHRINK_AMOUNT);
            lastAutoShrinkTime = gameTime;
        }

        if (isShrinking) {
            const elapsed = gameTime - shrinkStartTime;
            const progress = Math.min(elapsed / shrinkDuration, 1.0);
            const lerpedRadius = shrinkStartRadius + (shrinkTargetRadius - shrinkStartRadius) * progress;
            effectiveRadius = lerpedRadius;

            // Update planet scale
            planeta.scale.setScalar(effectiveRadius / originalPlanetRadius);

            // Update static obstacles
            for (let obj of staticObstacles) {
                if (obj.userData && obj.userData.isTree) {
                    const targetDist = effectiveRadius + obj.userData.offset;
                    obj.position.copy(obj.userData.radial.clone().multiplyScalar(targetDist));
                }
            }

            // Update lava spots positions y animar humo
            const scale = effectiveRadius / originalPlanetRadius;
            for (let lava of lavaSpots) {
                if (lava.userData && lava.userData.originalPosition) {
                    lava.position.copy(lava.userData.originalPosition.clone().multiplyScalar(scale));
                    if (lava.userData.smokes) {
                        lava.userData.smokes.forEach((smoke, index) => {
                            smoke.position.copy(lava.position);
                            smoke.position.add(new THREE.Vector3(
                                (Math.random() - 0.5) * 1.0,
                                1.0 + Math.random(),
                                (Math.random() - 0.5) * 1.0
                            ));
                        });
                    }
                }
            }

            // Update powerups positions
            for (let pu of powerUps) {
                if (pu.userData && pu.userData.originalPosition) {
                    pu.position.copy(pu.userData.originalPosition.clone().multiplyScalar(scale));
                }
            }

            // Update shadow camera
            if (sunLight && sunLight.shadow && sunLight.shadow.camera) {
                const shadowSize = effectiveRadius * 3;
                const shadowCamera = sunLight.shadow.camera;
                shadowCamera.left = -shadowSize;
                shadowCamera.right = shadowSize;
                shadowCamera.top = shadowSize;
                shadowCamera.bottom = -shadowSize;
                shadowCamera.updateProjectionMatrix();
            }

            if (progress >= 1.0) {
                isShrinking = false;
                currentPlanetRadius = shrinkTargetRadius;
                if (currentPlanetRadius <= WIN_RADIUS) {
                    winGame();
                }
            }
        }

        const currentSecond = Math.floor(gameTime);
        if (currentSecond > lastSecond) {
            METEOR_SPAWN_RATE = Math.min(0.06, METEOR_SPAWN_RATE + 0.003); // Aumento más rápido
            ENEMY_SPAWN_RATE = Math.min(0.012, ENEMY_SPAWN_RATE + 0.0008); // Aumento más rápido sin exceder
            lastSecond = currentSecond;
        }

        const currentInterval = Math.floor(gameTime / DIFFICULTY_INCREASE_INTERVAL);
        if (currentInterval > lastDifficultyIncrease) {
            POWERUP_SPAWN_RATE = Math.min(0.0003, POWERUP_SPAWN_RATE + 0.0001); // Menos powerups
            lastDifficultyIncrease = currentInterval;
        }

        if (invulnerable) {
            invulnTimer -= deltaTime;
            if (invulnTimer <= 0) {
                invulnerable = false;
            }
        }

        spawnMeteor(effectiveRadius);
        spawnEnemy(effectiveRadius);
        spawnPowerUp(effectiveRadius);
        updateObstacles(deltaTime, effectiveRadius);
        checkCollisions(deltaTime);
    }

    if (mixer) mixer.update(deltaTime);
    if (personaje && gameRunning) {
        personaje.visible = !invulnerable || (Math.floor(clock.getElapsedTime() * 10) % 2 === 0);
        updateCharacter(deltaTime, effectiveRadius);
        if (personaje) {
            const adjustedPos = personaje.position.clone().normalize().multiplyScalar(effectiveRadius + CHARACTER_HEIGHT);
            personaje.position.copy(adjustedPos);
            const newRadial = adjustedPos.normalize();
            if (!previousRadial.equals(newRadial)) {
                const correction = new THREE.Quaternion().setFromUnitVectors(previousRadial, newRadial);
                personaje.quaternion.premultiply(correction);
                previousRadial.copy(newRadial);
            }
        }
        updateCamera();
    }

    // Actualizar minimapa
    minimapAngle += deltaTime * 0.2;
    minimapCamera.position.x = Math.sin(minimapAngle) * effectiveRadius * 3;
    minimapCamera.position.z = Math.cos(minimapAngle) * effectiveRadius * 3;
    minimapCamera.lookAt(0, 0, 0);

    for (let i = explosions.length - 1; i >= 0; i--) {
        const exp = explosions[i];
        if (exp.userData.isExplosion) {
            if (exp.geometry.parameters.radius === EXPLOSION_RADIUS) {
                const elapsed = clock.getElapsedTime() - exp.userData.startTime;
                const progress = elapsed / exp.userData.duration;
                if (progress >= 1) {
                    scene.remove(exp);
                    explosions.splice(i, 1);
                } else {
                    exp.scale.setScalar(1 + progress * 3);
                    exp.material.opacity = Math.max(0, 0.9 * (1 - progress));
                    if (progress > 0.5) {
                        exp.material.color.setHSL(0, 1, (1 - progress) * 0.5);
                    }
                }
            } else {
                // Partículas
                exp.userData.life -= deltaTime;
                if (exp.userData.life <= 0) {
                    scene.remove(exp);
                    explosions.splice(i, 1);
                } else {
                    exp.position.add(exp.userData.velocity.clone().multiplyScalar(deltaTime));
                    exp.material.opacity = exp.userData.life;
                    exp.scale.setScalar(1 - exp.userData.life);
                }
            }
        }
    }

    // Update snow particles continuously
    if (window.snow) {
        const positions = window.snow.geometry.attributes.position.array;
        const velocities = window.snow.geometry.attributes.velocity.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += velocities[i] * deltaTime;
            positions[i+1] += velocities[i+1] * deltaTime;
            positions[i+2] += velocities[i+2] * deltaTime;
            
            // Reset if too close to center
            const len = Math.sqrt(positions[i]**2 + positions[i+1]**2 + positions[i+2]**2);
            if (len < effectiveRadius * 0.9) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = effectiveRadius * 1.2;
                positions[i] = r * Math.sin(phi) * Math.cos(theta);
                positions[i+1] = r * Math.sin(phi) * Math.sin(theta);
                positions[i+2] = r * Math.cos(phi);
                
                const dir = new THREE.Vector3(positions[i], positions[i+1], positions[i+2]).normalize();
                const speed = 0.5 + Math.random() * 1.0;
                velocities[i] = -dir.x * speed;
                velocities[i+1] = -dir.y * speed;
                velocities[i+2] = -dir.z * speed;
            }
        }
        window.snow.geometry.attributes.position.needsUpdate = true;
    }
}

function updateCharacter(deltaTime, effectiveRadius) {
    if (!personaje) return;
    const currentRadial = personaje.position.clone().normalize();
    const isMoving = keysPressed['w'] || keysPressed['arrowup'];

    if (keysPressed['a'] || keysPressed['arrowleft']) {
        const angle = -TURN_SPEED * deltaTime;
        const rotation = new THREE.Quaternion().setFromAxisAngle(currentRadial, angle);
        personaje.quaternion.premultiply(rotation);
    }
    if (keysPressed['d'] || keysPressed['arrowright']) {
        const angle = TURN_SPEED * deltaTime;
        const rotation = new THREE.Quaternion().setFromAxisAngle(currentRadial, angle);
        personaje.quaternion.premultiply(rotation);
    }

    if (keysPressed['s'] || keysPressed['arrowdown']) {
        const angle = Math.PI * deltaTime * 2;
        const rotation = new THREE.Quaternion().setFromAxisAngle(currentRadial, angle);
        personaje.quaternion.premultiply(rotation);
    }

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(personaje.quaternion);
    forward.projectOnPlane(currentRadial).normalize();

    if (isMoving) {
        const isColliding = checkStaticCollisions(personaje.position);
        const speedMult = isColliding ? 0.4 : 1.0;
        const radius = effectiveRadius + CHARACTER_HEIGHT;
        const moveVector = forward.clone().multiplyScalar(FORWARD_SPEED * deltaTime * speedMult);
        const oldPos = personaje.position.clone();
        const tentativeNewPos = oldPos.clone().add(moveVector).normalize().multiplyScalar(radius);
        personaje.position.copy(tentativeNewPos);
        const oldRadial = previousRadial.clone();
        const newRadial = tentativeNewPos.clone().normalize();
        if (actions['Walk']) setActiveAction(actions['Walk']);
        if (!oldRadial.equals(newRadial)) {
            const correction = new THREE.Quaternion().setFromUnitVectors(oldRadial, newRadial);
            personaje.quaternion.premultiply(correction);
        }
        previousRadial.copy(newRadial);
    } else {
        if (actions['Idle']) setActiveAction(actions['Idle']);
    }
}

function updateCamera() {
    if (!personaje) return;
    const characterUp = personaje.position.clone().normalize();
    const cameraOffset = new THREE.Vector3(0, CAMERA_HEIGHT, -CAMERA_DISTANCE * 0.4); 
    cameraOffset.applyMatrix4(personaje.matrixWorld);

    const lookAtTarget = new THREE.Vector3().setFromMatrixPosition(personaje.matrixWorld);
    lookAtTarget.add(characterUp.multiplyScalar(4));
    
    camera.position.lerp(cameraOffset, 0.05);
    camera.up.copy(characterUp);
    camera.lookAt(lookAtTarget);
}

function render() {
    requestAnimationFrame(render);
    update();
    renderer.render(scene, camera);
    minimapRenderer.render(scene, minimapCamera);
}