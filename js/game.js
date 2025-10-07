var renderer, scene, camera, cubo;
var cameraControls;
var angulo = -0.01;

init();
loadPlaneta(0.5, 'images/wood512.jpg');
loadPersonajeGLB('models/RobotExpressive.glb', 0.3); // ruta y escala
render();

function init()
{
  renderer = new THREE.WebGLRenderer();
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setClearColor( new THREE.Color(0xFFFFFF) );
  document.getElementById('container').appendChild( renderer.domElement );

  scene = new THREE.Scene();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera( 50, aspectRatio , 0.1, 100 );
  camera.position.set( 1, 1.5, 2 );
  camera.lookAt(0,0,0);

  cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
  cameraControls.target.set( 0, 0, 0 );

  window.addEventListener('resize', updateAspectRatio );
}

var planeta;
function loadPlaneta(radio, texturaURL)
{
    // Crear geometría esférica
    var geometria = new THREE.SphereGeometry(radio, 64, 64); // radio, segmentos ancho, segmentos alto

    // Cargar textura
    var textura = new THREE.TextureLoader().load(texturaURL);

    // Material
    var material = new THREE.MeshLambertMaterial({ 
        map: textura,   // textura aplicada
        side: THREE.DoubleSide 
    });

    // Crear mesh
    planeta = new THREE.Mesh(geometria, material);

    // Posicionar en la escena
    planeta.position.set(0, 0, 0);

    // Añadir luz direccional para iluminar el planeta
    var luz = new THREE.DirectionalLight(0xffffff, 1);
    luz.position.set(5, 5, 5);
    scene.add(luz);

    // Añadir planeta a la escena
    scene.add(planeta);
}

var personaje;
function loadPersonajeGLB(url, scale = 1.0) {
    const loader = new THREE.GLTFLoader();

    loader.load(
        url,
        function (gltf) {
            personaje = gltf.scene;
            personaje.scale.set(scale, scale, scale);
            personaje.position.set(0, 0, 0); // posición inicial
            scene.add(personaje);

            // Si el modelo tiene animaciones, configuramos el mixer
            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(personaje);
                const action = mixer.clipAction(gltf.animations[0]);
                action.play();
            }

            console.log('✅ Personaje cargado correctamente:', url);
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% cargado');
        },
        function (error) {
            console.error('❌ Error al cargar el modelo:', error);
        }
    );
}

function updateAspectRatio()
{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function update()
{
  // Cambios para actualizar la camara segun mvto del raton
  cameraControls.update();

  // Movimiento propio del cubo
  //cubo.rotation.y += angulo;
  //cubo.rotation.x += angulo/2;
}

function render()
{
	requestAnimationFrame( render );
	update();
	renderer.render( scene, camera );
}