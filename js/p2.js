var renderer, scene, camera, cameraMini;
var cameraControls;
var clock = new THREE.Clock();
var delta = 0;

var robot, baseBrazo, brazo, antebrazo, mano, pinzaIz, pinzaDe;
let material = new THREE.MeshNormalMaterial();

var controls = {
    giroBase: 0,
    giroBrazo: 0,
    giroAntebrazoY: 0,
    giroAntebrazoZ: 0,
    giroPinza: 0,
    separacionPinza: 10,
    alambrico: false,
    animacion: function() {
        iniciarAnimacion();
    }
};

// Keyframes para la animación - Secuencia personalizada
var keyframes = [
    [0, 0, 0, 0, 0, 10],           // Posición inicial
    [90, -30, 45, -20, 180, 2],    // Giro derecha + cierre pinza
    [90, -40, 90, -45, 200, 0],    // Extensión máxima
    [180, -25, 60, -30, 150, 5],   // Media vuelta
    [-90, -35, -60, 40, 100, 8],   // Giro izquierda
    [-90, -45, -90, 60, 50, 12],   // Posición baja
    [-180, -20, -45, 30, 20, 15],  // Vuelta completa + apertura
    [0, -40, 120, -80, -30, 3],    // Posición extrema
    [45, -15, 30, -15, 90, 7],     // Transición suave
    [0, -5, 10, -5, 45, 10],       // Casi inicial
    [0, 0, 0, 0, 0, 10]            // Retorno a inicial
];

var animacionActiva = false;

// Control de movimiento con teclado
var movimiento = {
    adelante: false,
    atras: false,
    izquierda: false,
    derecha: false
};

init();
render();

function init() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xffffff);
    document.getElementById('container').appendChild(renderer.domElement);

    // Scene
    scene = new THREE.Scene();

    // Cámara principal
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(100, 150, 200);

    // OrbitControls
    cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
    cameraControls.target.set(0, 60, 0);
    cameraControls.enableDamping = true;
    cameraControls.dampingFactor = 0.05;

    // Cámara miniatura cenital
    cameraMini = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 500);
    cameraMini.position.set(0, 300, 0);
    cameraMini.up.set(0, 0, -1);
    cameraMini.lookAt(0, 0, 0);

    // Luces
    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(50, 50, 50);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    // Cargar escena
    loadScene();

    // GUI
    setupGUI();

    // Event listeners
    window.addEventListener('resize', updateAspectRatio);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}

function loadScene() {
    const axesHelper = new THREE.AxesHelper(100);
    scene.add(axesHelper);

    robot = new THREE.Object3D();

    // Base
    let geometriaBase = new THREE.CylinderGeometry(50, 50, 15, 20, 20);
    baseBrazo = new THREE.Mesh(geometriaBase, material);
    baseBrazo.position.y = 15 / 2;
    robot.add(baseBrazo);

    // Brazo
    brazo = new THREE.Object3D();
    brazo.position.y = 15; // Posicionar brazo encima de la base

    // Eje
    let geometriaEje = new THREE.CylinderGeometry(20, 20, 18, 20, 20);
    let eje = new THREE.Mesh(geometriaEje, material);
    eje.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    brazo.add(eje);

    // Espárrago
    let geometriaEsparrago = new THREE.BoxGeometry(18, 120, 12);
    let esparrago = new THREE.Mesh(geometriaEsparrago, material);
    esparrago.position.y = 60;
    brazo.add(esparrago);

    // Rótula
    let geometriaRotula = new THREE.SphereGeometry(20, 20, 20);
    let rotula = new THREE.Mesh(geometriaRotula, material);
    rotula.position.y = 120;
    brazo.add(rotula);

    // Antebrazo
    antebrazo = new THREE.Object3D();
    antebrazo.position.y = 120;

    let geometriaDisco = new THREE.CylinderGeometry(22, 22, 6, 20, 20);
    let disco = new THREE.Mesh(geometriaDisco, material);
    antebrazo.add(disco);

    // Nervios
    let geometriaNervio = new THREE.BoxGeometry(4, 80, 4);
    let coords = [[-8, -8], [8, -8], [-8, 8], [8, 8]];
    for (let c of coords) {
        let nervio = new THREE.Mesh(geometriaNervio, material);
        nervio.position.set(c[0], 40, c[1]);
        antebrazo.add(nervio);
    }

    // Mano
    mano = new THREE.Object3D();
    mano.position.y = 80;
    let geometriaMano = new THREE.CylinderGeometry(15, 15, 40, 20, 20);
    let manoObj = new THREE.Mesh(geometriaMano, material);
    manoObj.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    mano.add(manoObj);

    // Pinzas
    let geometriaPinza = new THREE.BoxGeometry(19, 20, 4);
    pinzaIz = new THREE.Mesh(geometriaPinza, material);
    pinzaIz.position.set(19 / 2, 0, -10);
    mano.add(pinzaIz);

    pinzaDe = new THREE.Mesh(geometriaPinza, material);
    pinzaDe.position.set(19 / 2, 0, 10);
    mano.add(pinzaDe);

    // Dedos
    let geometriaDedo = new THREE.BufferGeometry();
    let vertices = new Float32Array([
        0, 10, -2, 0, 10, 2, 0, -10, 2, 0, -10, -2,
        19, 8, -1, 19, 8, 1, 19, -8, 1, 19, -8, -1
    ]);
    geometriaDedo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometriaDedo.setIndex(new THREE.BufferAttribute(new Uint16Array([
        0, 5, 4, 0, 1, 5, 1, 2, 5, 2, 6, 5, 2, 3, 6, 3, 7, 6, 0, 7, 3, 0, 4, 7, 4, 5, 6, 6, 7, 4
    ]), 1));
    geometriaDedo.computeVertexNormals();

    let dedo1 = new THREE.Mesh(geometriaDedo, material);
    dedo1.position.x = 19 / 2;
    pinzaDe.add(dedo1);

    let dedo2 = new THREE.Mesh(geometriaDedo, material);
    dedo2.position.x = 19 / 2;
    pinzaIz.add(dedo2);

    // Jerarquía
    antebrazo.add(mano);
    brazo.add(antebrazo);
    baseBrazo.add(brazo);
    scene.add(robot);

    // Suelo
    const planeGeometry = new THREE.PlaneGeometry(1000, 1000);
    let plano = new THREE.Mesh(planeGeometry, material);
    plano.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    scene.add(plano);
}

function setupGUI() {
    const gui = new lil.GUI();

    gui.add(controls, 'giroBase', -180, 180).name('Giro Base');
    gui.add(controls, 'giroBrazo', -45, 45).name('Giro Brazo');
    gui.add(controls, 'giroAntebrazoY', -180, 180).name('Giro Antebrazo Y');
    gui.add(controls, 'giroAntebrazoZ', -90, 90).name('Giro Antebrazo Z');
    gui.add(controls, 'giroPinza', -40, 220).name('Giro Pinza');
    gui.add(controls, 'separacionPinza', 0, 15).name('Separación Pinza');
    gui.add(controls, 'alambrico').name('Alámbrico');
    gui.add(controls, 'animacion').name('▶ Animación');
}

function iniciarAnimacion() {
    if (animacionActiva) return;
    animacionActiva = true;

    let frameIndex = 0;
    const duraciones = [1200, 1500, 1000, 1300, 1400, 1100, 1600, 1200, 1000, 1500];

    function animarFrame() {
        if (frameIndex >= keyframes.length - 1) {
            animacionActiva = false;
            return;
        }

        const start = keyframes[frameIndex];
        const end = keyframes[frameIndex + 1];
        const duracion = duraciones[frameIndex] || 1000;

        const startValues = {
            giroBase: start[0],
            giroBrazo: start[1],
            giroAntebrazoY: start[2],
            giroAntebrazoZ: start[3],
            giroPinza: start[4],
            separacionPinza: start[5]
        };

        const endValues = {
            giroBase: end[0],
            giroBrazo: end[1],
            giroAntebrazoY: end[2],
            giroAntebrazoZ: end[3],
            giroPinza: end[4],
            separacionPinza: end[5]
        };

        // Variar el tipo de easing según el frame
        let easing;
        if (frameIndex % 3 === 0) {
            easing = TWEEN.Easing.Cubic.InOut;
        } else if (frameIndex % 3 === 1) {
            easing = TWEEN.Easing.Elastic.Out;
        } else {
            easing = TWEEN.Easing.Bounce.Out;
        }

        new TWEEN.Tween(startValues)
            .to(endValues, duracion)
            .easing(easing)
            .onUpdate(() => {
                controls.giroBase = startValues.giroBase;
                controls.giroBrazo = startValues.giroBrazo;
                controls.giroAntebrazoY = startValues.giroAntebrazoY;
                controls.giroAntebrazoZ = startValues.giroAntebrazoZ;
                controls.giroPinza = startValues.giroPinza;
                controls.separacionPinza = startValues.separacionPinza;
            })
            .onComplete(() => {
                frameIndex++;
                animarFrame();
            })
            .start();
    }

    animarFrame();
}

function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
            movimiento.adelante = true;
            break;
        case 'ArrowDown':
            movimiento.atras = true;
            break;
        case 'ArrowLeft':
            movimiento.izquierda = true;
            break;
        case 'ArrowRight':
            movimiento.derecha = true;
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
            movimiento.adelante = false;
            break;
        case 'ArrowDown':
            movimiento.atras = false;
            break;
        case 'ArrowLeft':
            movimiento.izquierda = false;
            break;
        case 'ArrowRight':
            movimiento.derecha = false;
            break;
    }
}

function updateAspectRatio() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function update() {
    cameraControls.update();
    TWEEN.update();
    
    material.wireframe = controls.alambrico;

    // Aplicar rotaciones
    baseBrazo.rotation.y = controls.giroBase * (Math.PI / 180);
    brazo.rotation.z = controls.giroBrazo * (Math.PI / 180);
    antebrazo.rotation.y = controls.giroAntebrazoY * (Math.PI / 180);
    antebrazo.rotation.z = controls.giroAntebrazoZ * (Math.PI / 180);
    mano.rotation.z = controls.giroPinza * (Math.PI / 180);
    pinzaIz.position.z = -controls.separacionPinza - 2;
    pinzaDe.position.z = controls.separacionPinza + 2;

    // Movimiento con teclado
    const velocidad = 2 * delta;
    if (movimiento.adelante) robot.position.z -= velocidad;
    if (movimiento.atras) robot.position.z += velocidad;
    if (movimiento.izquierda) robot.position.x -= velocidad;
    if (movimiento.derecha) robot.position.x += velocidad;
}

function render() {
    requestAnimationFrame(render);
    delta = clock.getDelta() * 60.0;
    update();

    // Render principal
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(scene, camera);

    // Render miniatura cenital
    const size = Math.min(window.innerWidth, window.innerHeight) / 4;
    renderer.setViewport(10, window.innerHeight - size - 10, size, size);
    renderer.setScissor(10, window.innerHeight - size - 10, size, size);
    renderer.setScissorTest(true);
    renderer.render(scene, cameraMini);
}