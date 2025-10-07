// práctica 2 + cámara cenital miniatura

var renderer, scene, camera, cameraMini;
var cameraControls;
var delta = 0;
var clock = new THREE.Clock();

var robot, baseBrazo, brazo, antebrazo, mano, pinzaIz, pinzaDe;

let material = new THREE.MeshNormalMaterial();

var controls = {
  giroBase: 0,
  giroBrazo: 0,
  giroAntebrazoY: 0,
  giroAntebrazoZ: 0,
  giroPinza: 0,
  separacionPinza: 10,
  alambrico: false
};

// setup
init();
render();

function init() {
    // renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xffffff);
    document.getElementById('container').appendChild(renderer.domElement);

    // scene
    scene = new THREE.Scene();

    // cámara principal
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(100, 150, 200);

    // OrbitControls
    cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
    cameraControls.target.set(0, 60, 0);
    cameraControls.enableDamping = true;
    cameraControls.dampingFactor = 0.05;
    cameraControls.enablePan = true;
    cameraControls.enableZoom = true;

    // cámara miniatura cenital
    cameraMini = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 500);
    cameraMini.position.set(0, 300, 0); // cenital
    cameraMini.up.set(0, 0, -1); // orienta Z hacia arriba en miniatura
    cameraMini.lookAt(0, 0, 0);

    // luces
    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(50, 50, 50);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    // escena robot
    loadScene();

    window.addEventListener('resize', updateAspectRatio);
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

    // Eje (mirando a las pinzas)
    let geometriaEje = new THREE.CylinderGeometry(20, 20, 18, 20, 20);
    let eje = new THREE.Mesh(geometriaEje, material);
    eje.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    eje.position.y = 15; // justo encima de la base
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

    let geometriaNervio = new THREE.BoxGeometry(4, 80, 4);
    let coords = [[-8,-8], [8,-8], [-8,8], [8,8]];
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
    pinzaIz.position.set(19/2, 0, -10);
    mano.add(pinzaIz);
    pinzaDe = new THREE.Mesh(geometriaPinza, material);
    pinzaDe.position.set(19/2, 0, 10);
    mano.add(pinzaDe);

    // Dedo final
    let geometriaDedo = new THREE.BufferGeometry();
    let vertices = new Float32Array([
        0,10,-2, 0,10,2, 0,-10,2, 0,-10,-2,
        19,8,-1, 19,8,1, 19,-8,1, 19,-8,-1
    ]);
    geometriaDedo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometriaDedo.setIndex(new THREE.BufferAttribute(new Uint16Array([
        0,5,4,0,1,5,1,2,5,2,6,5,2,3,6,3,7,6,0,7,3,0,4,7,4,5,6,6,7,4
    ]), 1));
    geometriaDedo.computeVertexNormals();

    let dedo1 = new THREE.Mesh(geometriaDedo, material); dedo1.position.x = 19/2; pinzaDe.add(dedo1);
    let dedo2 = new THREE.Mesh(geometriaDedo, material); dedo2.position.x = 19/2; pinzaIz.add(dedo2);

    antebrazo.add(mano);
    brazo.add(antebrazo);
    baseBrazo.add(brazo);
    scene.add(robot);

    // Suelo
    const planeGeometry = new THREE.PlaneGeometry(1000,1000);
    let plano = new THREE.Mesh(planeGeometry, material);
    plano.rotateOnAxis(new THREE.Vector3(1,0,0), -Math.PI/2);
    scene.add(plano);
}

// Actualiza tamaño ventana
function updateAspectRatio() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

// update
function update() {
    cameraControls.update();
    material.wireframe = controls.alambrico;
}

// render
function render() {
    requestAnimationFrame(render);
    update();
    // render principal
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(scene, camera);

    // render miniatura
    const size = Math.min(window.innerWidth, window.innerHeight) / 4;
    renderer.setViewport(10, window.innerHeight - size - 10, size, size);
    renderer.setScissor(10, window.innerHeight - size - 10, size, size);
    renderer.setScissorTest(true);
    renderer.render(scene, cameraMini);
    delta = clock.getDelta() * 60.0;
}
