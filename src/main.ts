import "./style.css";
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTF, SkeletonUtils } from "three/examples/jsm/Addons.js";

document.addEventListener("DOMContentLoaded", () => new WebARExperience());

const gltfLoader = new GLTFLoader();

interface Props {
  gltfModel: GLTF;
  matrixPosition: THREE.Matrix4;
}

class Model {
  model: THREE.Object3D<THREE.Object3DEventMap>;
  gltfModel: GLTF;
  mixer: THREE.AnimationMixer;
  matrixPosition: THREE.Matrix4;
  constructor(props: Props) {
    Object.assign(this, props);

    this.createModel();
  }
  createModel() {
    this.model = SkeletonUtils.clone(this.gltfModel.scene);

    this.mixer = new THREE.AnimationMixer(this.model);
    this.mixer.clipAction(this.gltfModel.animations[0]).play();

    this.model.position.setFromMatrixPosition(this.matrixPosition);
    this.model.scale.set(0.5, 0.5, 0.5);
  }
  update(time: number) {
    this.mixer.update(time);
  }
}

class WebARExperience {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  controller: THREE.XRTargetRaySpace;
  reticle: THREE.Mesh;
  container: HTMLElement;
  gltfModel: GLTF;
  models: any[];
  hitTestSource: XRHitTestSource | undefined;
  clock: THREE.Clock;

  constructor() {
    this.container = document.getElementById("app")!;
    this.initialize();
    this.loadModel();
    this.clock = new THREE.Clock();
    this.models = [];

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera();
  }

  loadModel() {
    gltfLoader.load("/animated_bengal_cat/scene.gltf", (gltf: GLTF) => {
      this.gltfModel = gltf;
    });
  }

  initialize = async () => {
    this.setRenderer();
    this.setController();
    this.environment();
    this.createReticle();
    this.createARButton();
  };

  environment() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    this.scene.add(ambientLight);
  }

  setRenderer() {
    this.renderer = new THREE.WebGLRenderer({ alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;

    this.renderer.xr.addEventListener("sessionstart", () => {
      window.alert("clicked");
      this.sessionStart();
    });

    this.renderer.xr.addEventListener("sessionend", async () => {});
  }

  setController() {
    this.controller = this.renderer.xr.getController(0);
    this.container.appendChild(this.renderer.domElement);
    this.controller.addEventListener("select", () => this.controllerOnSelect());
  }

  controllerOnSelect() {
    const newModel = new Model({
      gltfModel: this.gltfModel,
      matrixPosition: this.reticle.matrix,
    });

    this.models.push(newModel);
    this.scene.add(newModel.model);
  }

  createReticle() {
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial()
    );

    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);
  }

  createARButton() {
    const arButton = ARButton.createButton(this.renderer, {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay"],
      domOverlay: { root: this.container },
    });
    this.container.appendChild(arButton);
  }

  sessionStart = async () => {
    const session = this.renderer.xr.getSession();
    if (!session) return;
    const viewerReferenceSpace = await session.requestReferenceSpace("viewer");

    if (!session.requestHitTestSource) return;

    this.hitTestSource = await session.requestHitTestSource({
      space: viewerReferenceSpace,
    });
    this.onUpdate();
  };

  checkHitTest(frame: XRFrame) {
    const hitTestResults = frame.getHitTestResults(this.hitTestSource!);

    if (hitTestResults.length > 0) {
      const hit = hitTestResults[0];

      const referenceSpace = this.renderer.xr.getReferenceSpace()!;
      const hitPose = hit.getPose(referenceSpace)!;

      this.reticle.visible = true;
      this.reticle.matrix.fromArray(hitPose.transform.matrix);
    } else {
      this.reticle.visible = false;
    }
  }

  onUpdate() {
    this.renderer.setAnimationLoop((_, frame) => {
      if (!frame) return;
      this.checkHitTest(frame);

      if (this.models.length > 0) {
        this.models.forEach((model) => {
          model.update(this.clock.getDelta());
        });
      }

      this.renderer.render(this.scene, this.camera);
    });
  }
}
