import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import "./qr.js";

import "./style.css";

let container;
let camera, scene, renderer;
let controller;

let reticle;

let hitTestSource = null;
let hitTestSourceRequested = false;
let planeFound = false;
let flowersGltf;
let mesh;
let isPlaced = false;

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

  function onSelect() {
    if (isPlaced) return;

    // Define the desired real-world size in meters
    let desiredRealWorldSize = 3.048; // meters

    // Get the bounding box of the model to determine its original size
    let boundingBox = new THREE.Box3().setFromObject(mesh);
    let originalModelSize = boundingBox.getSize(new THREE.Vector3()).length();

    // Calculate the scale factor
    let scaleFactor = desiredRealWorldSize / originalModelSize;

    // Apply the scale to the model
    //mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // mesh.rotation.x = (90 * Math.PI) / 180; // 90 degrees in radians

    mesh.position.setFromMatrixPosition(reticle.matrix);
    // mesh.quaternion.setFromRotationMatrix(reticle.matrix);

    scene.add(mesh);

    isPlaced = true;
  }

  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  controller.addEventListener("selectstart", onSelectStart);
  controller.addEventListener("selectend", onSelectEnd);
  scene.add(controller);

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const loader = new GLTFLoader();

  //loader.load("evcharger/evcharger.gltf", (gltf) => {
  loader.load("evcharger.glb", (gltf) => {
    // flowersGltf = gltf.scene;
    mesh = gltf.scene;
  });

  window.addEventListener("resize", onWindowResize);

  renderer.domElement.addEventListener(
    "touchstart",
    function (e) {
      console.log("touchstart");
      e.preventDefault();
      touchDown = true;
      touchX = e.touches[0].pageX;
      touchY = e.touches[0].pageY;
    },
    false
  );

  renderer.domElement.addEventListener(
    "touchend",
    function (e) {
      console.log("touchstart");

      e.preventDefault();
      touchDown = false;
    },
    false
  );

  renderer.domElement.addEventListener(
    "touchmove",
    function (e) {
      e.preventDefault();
      console.log("touchmove");

      if (!touchDown) {
        return;
      }

      deltaX = e.touches[0].pageX - touchX;
      deltaY = e.touches[0].pageY - touchY;
      touchX = e.touches[0].pageX;
      touchY = e.touches[0].pageY;

      rotateObject();
    },
    false
  );

  var touchDown, touchX, touchY, deltaX, deltaY;
}

function rotateObject() {
  //if(mesh && reticle.visible){
  mesh.rotation.y += deltaX / 100;
  //	}
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
