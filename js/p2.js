var renderer, scene, camera, cameraMini;
var cameraControls;
var clock = new THREE.Clock();
var delta = 0;

var robot, baseBrazo, brazo, antebrazo, mano, pinzaIz, pinzaDe;

// Materiales
var materialBase, materialEje, materialEsparrago, materialRotula;
var materialDisco, materialNervios, materialMano, materialPinzas;

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

var keyframes = [
    [0, 0, 0, 0, 0, 10],
    [90, -30, 45, -20, 180, 2],
    [90, -40, 90, -45, 200, 0],
    [180, -25, 60, -30, 150, 5],
    [-90, -35, -60, 40, 100, 8],
    [-90, -45, -90, 60, 50, 12],
    [-180, -20, -45, 30, 20, 15],
    [0, -40, 120, -80, -30, 3],
    [45, -15, 30, -15, 90, 7],
    [0, -5, 10, -5, 45, 10],
    [0, 0, 0, 0, 0, 10]
];

var animacionActiva = false;

var movimiento = {
    adelante: false,
    atras: false,
    izquierda: false,
    derecha: false
};

init();
render();

function init() {
    // Renderer con sombras
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x202020);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('container').appendChild(renderer.domElement);

    scene = new THREE.Scene();

    // Cámara principal
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(150, 200, 250);

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

    setupLights();
    loadScene();
    setupGUI();

    window.addEventListener('resize', updateAspectRatio);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}

function setupLights() {
    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    // Luz direccional con sombras
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -200;
    dirLight.shadow.camera.right = 200;
    dirLight.shadow.camera.top = 200;
    dirLight.shadow.camera.bottom = -200;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Luz focal (SpotLight) con sombras
    const spotLight = new THREE.SpotLight(0xffffff, 1);
    spotLight.position.set(-50, 150, 100);
    spotLight.angle = Math.PI / 6;
    spotLight.penumbra = 0.3;
    spotLight.decay = 2;
    spotLight.distance = 500;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    scene.add(spotLight);

    // Luz puntual adicional
    const pointLight = new THREE.PointLight(0xffaa00, 0.5, 300);
    pointLight.position.set(50, 100, -50);
    scene.add(pointLight);
}

function loadScene() {
    const axesHelper = new THREE.AxesHelper(100);
    scene.add(axesHelper);

    // Cargar texturas
    const textureLoader = new THREE.TextureLoader();
    
    // Texturas para el robot
    const texturaMetalica = textureLoader.load('images/metal_128.jpg');
    const texturaMadera = textureLoader.load('images/wood512.jpg');

    // Textura para el suelo
    const texturaSuelo = textureLoader.load('images/pisometalico_1024.jpg');
    texturaSuelo.wrapS = THREE.RepeatWrapping;
    texturaSuelo.wrapT = THREE.RepeatWrapping;
    texturaSuelo.repeat.set(4, 4);

    // Environment map para la rótula
    const cubeTextureLoader = new THREE.CubeTextureLoader();
    const envMap = cubeTextureLoader.load([
        'images/posx.jpg', 'images/negx.jpg',
        'images/posy.jpg', 'images/negy.jpg',
        'images/posz.jpg', 'images/negz.jpg'
    ]);

    // Materiales
    materialBase = new THREE.MeshPhongMaterial({ 
        map: texturaMetalica,
        shininess: 80,
        specular: 0x444444
    });

    materialEje = new THREE.MeshLambertMaterial({ 
        map: texturaMadera
    });

    materialEsparrago = new THREE.MeshPhongMaterial({ 
        map: texturaMadera,
        shininess: 60,
        specular: 0x666666
    });

    materialRotula = new THREE.MeshPhongMaterial({ 
        envMap: envMap,
        reflectivity: 0.9,
        shininess: 100,
        specular: 0xffffff
    });

    materialDisco = new THREE.MeshPhongMaterial({ 
        map: texturaMadera,
        shininess: 70,
        specular: 0x555555
    });

    materialNervios = new THREE.MeshLambertMaterial({ 
        map: texturaMetalica
    });

    materialMano = new THREE.MeshPhongMaterial({ 
        map: texturaMetalica,
        shininess: 90,
        specular: 0x888888
    });

    materialPinzas = new THREE.MeshLambertMaterial({ 
        color: 0xcccccc
    });

    // Construir habitación (skybox interior)
    const materialHabitacion = [
        new THREE.MeshBasicMaterial({ map: textureLoader.load('images/posx.jpg'), side: THREE.BackSide }),
        new THREE.MeshBasicMaterial({ map: textureLoader.load('images/negx.jpg'), side: THREE.BackSide }),
        new THREE.MeshBasicMaterial({ map: textureLoader.load('images/posy.jpg'), side: THREE.BackSide }),
        new THREE.MeshBasicMaterial({ map: textureLoader.load('images/negy.jpg'), side: THREE.BackSide }),
        new THREE.MeshBasicMaterial({ map: textureLoader.load('images/posz.jpg'), side: THREE.BackSide }),
        new THREE.MeshBasicMaterial({ map: textureLoader.load('images/negz.jpg'), side: THREE.BackSide })
    ];
    
    const habitacionGeom = new THREE.BoxGeometry(1000, 1000, 1000);
    const habitacion = new THREE.Mesh(habitacionGeom, materialHabitacion);
    habitacion.position.y = 499; // Mover hacia arriba para que el suelo esté en Y=0
    scene.add(habitacion);

    // Robot
    robot = new THREE.Object3D();
    robot.position.y = 7.5; // Elevar el robot para que la base toque el suelo

    // Base - ajustada para que toque el suelo
    let geometriaBase = new THREE.CylinderGeometry(50, 50, 15, 32);
    baseBrazo = new THREE.Mesh(geometriaBase, materialBase);
    baseBrazo.castShadow = true;
    baseBrazo.receiveShadow = true;
    robot.add(baseBrazo);

    // Brazo
    brazo = new THREE.Object3D();
    brazo.position.y = 0;

    // Eje
    let geometriaEje = new THREE.CylinderGeometry(20, 20, 18, 32);
    let eje = new THREE.Mesh(geometriaEje, materialEje);
    eje.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    eje.castShadow = true;
    eje.receiveShadow = true;
    brazo.add(eje);

    // Espárrago con UV corregidas
    let geometriaEsparrago = new THREE.BoxGeometry(18, 120, 12);
    // Corregir las coordenadas UV para que la textura no aparezca invertida
    const uvsEsparrago = geometriaEsparrago.attributes.uv.array;
    for (let i = 1; i < uvsEsparrago.length; i += 2) {
        uvsEsparrago[i] = 1 - uvsEsparrago[i]; // Invertir coordenada V
    }
    geometriaEsparrago.attributes.uv.needsUpdate = true;
    
    let esparrago = new THREE.Mesh(geometriaEsparrago, materialEsparrago);
    esparrago.position.y = 60;
    esparrago.castShadow = true;
    esparrago.receiveShadow = true;
    brazo.add(esparrago);

    // Rótula con environment map
    let geometriaRotula = new THREE.SphereGeometry(20, 32, 32);
    let rotula = new THREE.Mesh(geometriaRotula, materialRotula);
    rotula.position.y = 120;
    rotula.castShadow = true;
    rotula.receiveShadow = true;
    brazo.add(rotula);

    // Antebrazo
    antebrazo = new THREE.Object3D();
    antebrazo.position.y = 120;

    let geometriaDisco = new THREE.CylinderGeometry(22, 22, 6, 32);
    let disco = new THREE.Mesh(geometriaDisco, materialDisco);
    disco.castShadow = true;
    disco.receiveShadow = true;
    antebrazo.add(disco);

    // Nervios con UV corregidas
    let geometriaNervio = new THREE.BoxGeometry(4, 80, 4);
    // Corregir las coordenadas UV
    const uvsNervio = geometriaNervio.attributes.uv.array;
    for (let i = 1; i < uvsNervio.length; i += 2) {
        uvsNervio[i] = 1 - uvsNervio[i];
    }
    geometriaNervio.attributes.uv.needsUpdate = true;
    
    let coords = [[-8, -8], [8, -8], [-8, 8], [8, 8]];
    for (let c of coords) {
        let nervio = new THREE.Mesh(geometriaNervio, materialNervios);
        nervio.position.set(c[0], 40, c[1]);
        nervio.castShadow = true;
        nervio.receiveShadow = true;
        antebrazo.add(nervio);
    }

    // Mano
    mano = new THREE.Object3D();
    mano.position.y = 80;
    let geometriaMano = new THREE.CylinderGeometry(15, 15, 40, 32);
    let manoObj = new THREE.Mesh(geometriaMano, materialMano);
    manoObj.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    manoObj.castShadow = true;
    manoObj.receiveShadow = true;
    mano.add(manoObj);

    // Pinzas
    let geometriaPinza = new THREE.BoxGeometry(19, 20, 4);
    pinzaIz = new THREE.Mesh(geometriaPinza, materialPinzas);
    pinzaIz.position.set(19 / 2, 0, -10);
    pinzaIz.castShadow = true;
    pinzaIz.receiveShadow = true;
    mano.add(pinzaIz);

    pinzaDe = new THREE.Mesh(geometriaPinza, materialPinzas);
    pinzaDe.position.set(19 / 2, 0, 10);
    pinzaDe.castShadow = true;
    pinzaDe.receiveShadow = true;
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

    let materialDedos = new THREE.MeshLambertMaterial({ color: 0x999999 });

    let dedo1 = new THREE.Mesh(geometriaDedo, materialDedos);
    dedo1.position.x = 19 / 2;
    dedo1.castShadow = true;
    dedo1.receiveShadow = true;
    pinzaDe.add(dedo1);

    let dedo2 = new THREE.Mesh(geometriaDedo, materialDedos);
    dedo2.position.x = 19 / 2;
    dedo2.castShadow = true;
    dedo2.receiveShadow = true;
    pinzaIz.add(dedo2);

    // Jerarquía
    antebrazo.add(mano);
    brazo.add(antebrazo);
    baseBrazo.add(brazo);
    scene.add(robot);

    // Suelo con textura
    const planeGeometry = new THREE.PlaneGeometry(1000, 1000);
    const materialSuelo = new THREE.MeshPhongMaterial({ 
        map: texturaSuelo,
        shininess: 30
    });
    let plano = new THREE.Mesh(planeGeometry, materialSuelo);
    plano.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    plano.receiveShadow = true;
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
            movimiento.derecha = true;
            //movimiento.adelante = true;
            break;
        case 'ArrowDown':
            movimiento.izquierda = true;
            //movimiento.atras = true;
            break;
        case 'ArrowLeft':
            movimiento.atras = true;
            break;
        case 'ArrowRight':
            movimiento.adelante = true;
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
            movimiento.derecha = false;
            break;
        case 'ArrowDown':
            movimiento.izquierda = false;
            //movimiento.atras = false;
            break;
        case 'ArrowLeft':
            movimiento.atras = false;
            break;
        case 'ArrowRight':
            movimiento.adelante = false;
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
    
    // Wireframe
    if (controls.alambrico) {
        materialBase.wireframe = true;
        materialEje.wireframe = true;
        materialEsparrago.wireframe = true;
        materialRotula.wireframe = true;
        materialDisco.wireframe = true;
        materialNervios.wireframe = true;
        materialMano.wireframe = true;
        materialPinzas.wireframe = true;
    } else {
        materialBase.wireframe = false;
        materialEje.wireframe = false;
        materialEsparrago.wireframe = false;
        materialRotula.wireframe = false;
        materialDisco.wireframe = false;
        materialNervios.wireframe = false;
        materialMano.wireframe = false;
        materialPinzas.wireframe = false;
    }

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