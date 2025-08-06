import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

function init() {
  // Create the canvas and WebGL renderer
  const canvas = document.getElementById('webgl')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)

  // Create the scene and set the background color for night sky
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x060945)

  // Create the camera with perspective projection
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  )
  camera.position.set(0, 3, 10)

  // Add a single ambient light so the scene is visible at night
  const ambientLight = new THREE.AmbientLight(0x8888aa, 3)
  scene.add(ambientLight)

  // Create a group to hold the static stars rendered as small spheres
  const starGroup = new THREE.Group()
  const starGeometry = new THREE.SphereGeometry(0.2, 6, 6)
  const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const starCount = 1000
  const skyRadius = 50

  // Distribute static stars randomly on the inner surface of a large sphere
  for (let i = 0; i < starCount; i++) {
    const star = new THREE.Mesh(starGeometry, starMaterial)
    const theta = THREE.MathUtils.randFloat(0, Math.PI * 2)
    const phi = THREE.MathUtils.randFloat(0, Math.PI)
    star.position.set(
      skyRadius * Math.sin(phi) * Math.cos(theta),
      skyRadius * Math.cos(phi),
      skyRadius * Math.sin(phi) * Math.sin(theta)
    )
    starGroup.add(star)
  }
  scene.add(starGroup)

  // Prepare an array and clock to track active shooting stars
  const shootingStars = []
  const clock = new THREE.Clock()

  // Define maximum points in the trail buffer
  const maxTrailPoints = 30

  // Create a custom shader material for fading trails
  const trailMaterial = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `
      attribute float aIndex;
      varying float vIndex;
      void main() {
        vIndex = aIndex;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying float vIndex;
      void main() {
        float alpha = 1.0 - vIndex;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })

  // Function to spawn a single shooting star with trail
    function createShootingStar() {
    // Create the moving star as a small sphere mesh
    const starGeo = new THREE.SphereGeometry(0.1, 6, 6)
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const star = new THREE.Mesh(starGeo, starMat)

    // Choose a random start point near the top of the sky dome
    const R = 50
    const theta1 = Math.random() * Math.PI * 2          // full azimuthal range
    const phi1 = THREE.MathUtils.randFloat(0.05, 0.2) * Math.PI
    star.position.set(
      R * Math.sin(phi1) * Math.cos(theta1),
      R * Math.cos(phi1),
      R * Math.sin(phi1) * Math.sin(theta1)
    )

    // Choose a random end point also on the dome above the horizon
    const theta2 = Math.random() * Math.PI * 2
    const phi2 = THREE.MathUtils.randFloat(0.05, 0.4) * Math.PI
    const target = new THREE.Vector3(
      R * Math.sin(phi2) * Math.cos(theta2),
      R * Math.cos(phi2),
      R * Math.sin(phi2) * Math.sin(theta2)
    )

    // Compute a flight time between two and four seconds
    const flightTime = THREE.MathUtils.randFloat(2, 4)
    // Compute velocity so the star travels from start to target in that time
    const velocity = new THREE.Vector3()
      .subVectors(target, star.position)
      .divideScalar(flightTime)

    // Prepare a fixed size buffer geometry for the trail
    const trailGeo = new THREE.BufferGeometry()
    const positions = new Float32Array(maxTrailPoints * 3)
    const indices = new Float32Array(maxTrailPoints)
    trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    trailGeo.setAttribute('aIndex', new THREE.BufferAttribute(indices, 1))
    const trailLine = new THREE.Line(trailGeo, trailMaterial)

    // Store metadata so we can animate and fade the trail
    star.userData = {
      velocity: velocity,
      life: 0,
      maxLife: flightTime,
      trail: {
        mesh: trailLine,
        geo: trailGeo,
        points: []
      }
    }

    // Add the star mesh and its trail line to the scene
    scene.add(trailLine)
    scene.add(star)
    shootingStars.push(star)
  }


  // Spawn a new shooting star every two to four seconds
  setInterval(createShootingStar, THREE.MathUtils.randInt(2000, 4000))

  // Load the moon texture and create a sprite for it
  const loader = new THREE.TextureLoader()
  const moonTex = loader.load('/assets/moon.webp')
  const moonMat = new THREE.SpriteMaterial({ map: moonTex, transparent: true })
  const moon = new THREE.Sprite(moonMat)
  moon.scale.set(20, 20, 1)
  moon.position.set(30, 30, -50)
  scene.add(moon)

  // Create toon materials for the farm scene
  const groundMat = new THREE.MeshToonMaterial({ color: 0x224422 })
  const cropMat = new THREE.MeshToonMaterial({ color: 0x336633 })
  const houseMat = new THREE.MeshToonMaterial({ color: 0x332211 })
  const roofMat = new THREE.MeshToonMaterial({ color: 0x552222 })
  const barnMat = new THREE.MeshToonMaterial({ color: 0x442222 })
  const barnRoofMat = new THREE.MeshToonMaterial({ color: 0x222222 })

  // Create and add the ground plane
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), groundMat)
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // Create the row of crops on the left
  const farmGroup = new THREE.Group()
  for (let z = -4; z <= 4; z += 2) {
    const crop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 6), cropMat)
    crop.position.set(-8, 0.5, z)
    farmGroup.add(crop)
  }
  scene.add(farmGroup)

  // Create the farmhouse at center
  const houseGroup = new THREE.Group()
  const houseBody = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), houseMat)
  houseBody.position.y = 1
  const houseRoof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1, 4), roofMat)
  houseRoof.position.y = 2.5
  houseRoof.rotation.y = Math.PI / 4
  houseGroup.add(houseBody, houseRoof)
  scene.add(houseGroup)

  // Create the barn on the right
  const barnGroup = new THREE.Group()
  const barnBody = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 3), barnMat)
  barnBody.position.y = 1.25
  const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1, 4), barnRoofMat)
  barnRoof.position.y = 2.75
  barnRoof.rotation.y = Math.PI / 4
  barnGroup.add(barnBody, barnRoof)
  barnGroup.position.x = 8
  scene.add(barnGroup)

  // Add orbit controls so we can look around
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.minDistance = 5
  controls.maxDistance = 30
  controls.maxPolarAngle = Math.PI / 2 - 0.1

  // Handle window resize events
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  // Main render loop that updates shooting stars and renders the scene
  function animate() {
    const delta = clock.getDelta()

    // Update each shooting star
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const star = shootingStars[i]
      const data = star.userData

      // Move the star according to its velocity
      star.position.addScaledVector(data.velocity, delta)
      data.life += delta

      // Record the new position into the trail points array
      data.trail.points.unshift(star.position.clone())
      if (data.trail.points.length > data.trail.geo.attributes.position.count) {
        data.trail.points.pop()
      }

      // Update the trail geometry attributes with new positions and fade indices
      const posArray = data.trail.geo.attributes.position.array
      const idxArray = data.trail.geo.attributes.aIndex.array
      data.trail.points.forEach((p, j) => {
        posArray[3 * j] = p.x
        posArray[3 * j + 1] = p.y
        posArray[3 * j + 2] = p.z
        idxArray[j] = j / data.trail.points.length
      })
      data.trail.geo.attributes.position.needsUpdate = true
      data.trail.geo.attributes.aIndex.needsUpdate = true

      // Remove the star and its trail once its life is over
      if (data.life >= data.maxLife) {
        scene.remove(star, data.trail.mesh)
        shootingStars.splice(i, 1)
      }
    }

    controls.update()
    renderer.render(scene, camera)
    requestAnimationFrame(animate)
  }

  animate()
}

// Start everything when the window finishes loading
window.addEventListener('load', init)
