
import * as THREE from "https://unpkg.com/three@0.153.0/build/three.module.js";
import { ARButton } from "https://unpkg.com/three@0.153.0/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "https://unpkg.com/three@0.153.0/examples/jsm/loaders/GLTFLoader.js";


//import "./qr.js";

// import "./style.css";

let container;
let camera, scene, renderer;
let controller;
let reticle;

let hitTestSource = null;
let hitTestSourceRequested = false;
let planeFound = false;
let mesh;
let isPlaced = false;

let touchDown, touchX, touchY, deltaX, deltaY;

// check for webxr session support
if ("xr" in navigator) {
  navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
    if (supported) {
      //hide "ar-not-supported"
      document.getElementById("ar-not-supported").style.display = "none";
      init();
      animate();
    }
  });
}

function sessionStart() {
  planeFound = false;
  //show #tracking-prompt
  document.getElementById("tracking-prompt").style.display = "block";
}

function init() {
  container = document.createElement("div");
  document.body.appendChild(container);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  light.position.set(0.5, 1, 0.25);
  scene.add(light);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  renderer.xr.addEventListener("sessionstart", sessionStart);

  document.body.appendChild(
    ARButton.createButton(renderer, {
      requiredFeatures: ["local", "hit-test", "dom-overlay"],
      domOverlay: { root: document.querySelector("#overlay") },
    })
  );

  // Your DOM overlay setup

  //const placeButton = document.getElementById("reset-button");
  const placeButton = document.getElementById("instructions");
  placeButton.addEventListener("touchend", reset);

  var overlay = document.getElementById("overlay");

  // Register events on the DOM overlay
  overlay.addEventListener("touchstart", onTouchStart, false);
  overlay.addEventListener("touchmove", onTouchMove, false);
  overlay.addEventListener("touchend", onTouchEnd, false);

  function onTouchStart(e) {
    console.log(e);
    e.preventDefault();
    touchDown = true;
    touchX = e.touches[0].pageX;
    touchY = e.touches[0].pageY;
  }

  function onTouchEnd(e) {
    e.preventDefault();
    touchDown = false;
  }

  function onTouchMove(e) {
    e.preventDefault();

    if (!touchDown && !isPlaced) {
      return;
    }

    deltaX = e.touches[0].pageX - touchX;
    deltaY = e.touches[0].pageY - touchY;
    touchX = e.touches[0].pageX;
    touchY = e.touches[0].pageY;

    translateObject();
  }

  function translateObject() {
    if (mesh && isPlaced) {
      if (deltaX != 0) mesh.position.x += deltaX / 100;
      else mesh.position.y -= deltaY / 100;
    }
  }

  function onSelect() {
    if (isPlaced || !reticle.visible) return;
    console.log("onSelect");
    mesh.position.setFromMatrixPosition(reticle.matrix);
    // mesh.quaternion.setFromRotationMatrix(reticle.matrix);
    scene.add(mesh);
    isPlaced = true;
  }

  function reset(e) {
    e.stopPropagation();
    //e.preventDefault();

    console.log("reset");
    if (!isPlaced) {
      onSelect();
    } else {
      scene.remove(mesh);
      isPlaced = false;
    }
    placeButton.innerHTML = isPlaced ? "Reset" : "Tap to Place EV Charger";
  }

  // controller = renderer.xr.getController(0);
  // controller.addEventListener("select", onSelect);
  // scene.add(controller);

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const loader = new GLTFLoader();

  loader.load("evcharger.glb", (gltf) => {
    mesh = gltf.scene;
  });

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (hitTestSourceRequested === false) {
      session.requestReferenceSpace("viewer").then(function (referenceSpace) {
        session
          .requestHitTestSource({ space: referenceSpace })
          .then(function (source) {
            hitTestSource = source;
          });
      });

      session.addEventListener("end", function () {
        hitTestSourceRequested = false;
        hitTestSource = null;

        //Remove object from scene
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length) {
        if (!planeFound) {
          planeFound = true;
          //hide #tracking-prompt
          document.getElementById("tracking-prompt").style.display = "none";
          document.getElementById("instructions").style.display = "flex";
        }
        const hit = hitTestResults[0];

        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }
  renderer.render(scene, camera);
}
