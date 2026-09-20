"""
Render a tumbling-leaf sprite sheet in Blender.

Run with:
    blender -b -P tools/render_leaves.py
then assemble with:
    python tools/build_leaf_sheet.py

Produces FRAMES columns by one row per variant. Each row is one full 360-degree
rotation about the leaf's long axis, so playing a row back on a loop reads as a
leaf fluttering edge-on and flat again. Because the rotation completes exactly
one turn across the row, the loop is seamless.

The three variants differ in silhouette as well as colour, so a drift of leaves
does not look like one leaf duplicated.

Veins are geometry, not texture: a raised midrib plus narrow gaussian ridges
swept off it. Real ridges catch the light as the leaf turns, which is what
sells it when the sprite is only ~20px on screen.

Rendered in Cycles. EEVEE fakes subsurface, and the light passing through the
blade is most of what makes a leaf read as organic rather than as a green chip.

This is a build-time tool. The site ships the rendered sheet and does not
depend on Blender.
"""

import math
import os
import tempfile

import bpy

FRAMES = 28
TILE = 128          # rendered size; downsampled when the sheet is assembled

# (name, shape index, base colour, tip colour)
VARIANTS = [
    ("fresh", 0, (0.055, 0.210, 0.035), (0.130, 0.330, 0.060)),
    ("light", 1, (0.140, 0.300, 0.050), (0.330, 0.470, 0.090)),
    ("amber", 2, (0.330, 0.240, 0.045), (0.560, 0.360, 0.070)),
]

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(PROJECT, "public", "images")


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


def build_leaf(name, shape=0, segments=120, across=41):
    """Displaced leaf surface: raised midrib plus crisp secondary veins."""
    # `width` is tuned so the half-width peaks near 0.5, giving a width:length
    # of about 1:2, which is what a broad leaf actually looks like.
    peak, taper, width = [
        (0.62, 0.70, 0.88),   # broad ovate
        (0.52, 0.84, 0.76),   # narrower, longer tip
        (0.74, 0.60, 0.94),   # rounder, fuller
    ][shape]

    STEM_W = 0.016
    verts, faces = [], []

    for i in range(segments + 1):
        u = i / segments                      # 0 at base, 1 at tip
        y = -1.0 + 2.0 * u

        blade = 1.42 * (u ** peak) * ((1.0 - u) ** taper) * width
        # Flare smoothly out of the stem. Clamping instead leaves a blunt
        # wedge where the stem meets the blade.
        half = max(STEM_W + (blade - STEM_W) * smoothstep(0.03, 0.17, u), 1e-4)

        for j in range(across):
            v = -1.0 + 2.0 * (j / (across - 1))   # -1 left edge, +1 right edge
            x = v * half

            # Cup the blade away from the midrib.
            z = 0.10 * (v * v) * (1.0 - 0.4 * u)

            # Midrib.
            z -= 0.060 * math.exp(-(v * v) / 0.013) * (1.0 - 0.55 * u)

            # Secondary veins: narrow gaussian ridges on a phase that sweeps
            # with distance from the midrib, so they angle toward the tip.
            # A broad sine here reads as quilting instead of veins.
            phase = u * 8.5 - abs(v) * 1.7
            frac = phase - math.floor(phase)
            ridge = math.exp(-((frac - 0.5) ** 2) / 0.007)
            z -= 0.016 * ridge * (1.0 - abs(v) * 0.22) * smoothstep(0.12, 0.3, u)

            # Whole-leaf curl, a twist along the length, and slight edge
            # waviness so the outline is not machined.
            z += 0.30 * (u ** 2.8)
            z += 0.08 * v * math.sin(math.pi * u)
            z += 0.012 * math.sin(u * 16.0) * (abs(v) ** 3)

            verts.append((x, y, z))

    for i in range(segments):
        for j in range(across - 1):
            a = i * across + j
            faces.append((a, a + 1, a + across + 1, a + across))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    mesh.update()
    for poly in mesh.polygons:
        poly.use_smooth = True

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    solidify = obj.modifiers.new("Solidify", "SOLIDIFY")
    solidify.thickness = 0.007
    solidify.offset = 0.0
    return obj


def leaf_material(name, base, tip):
    """Principled leaf: base-to-tip gradient, mottling, and translucency."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links

    # Look nodes up by type. Node names are localized on a non-English UI.
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    out = next(n for n in nodes if n.type == "OUTPUT_MATERIAL")

    texco = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(texco.outputs["Generated"], sep.inputs["Vector"])

    # Generated Y runs base (0) to tip (1). A uniform green reads as plastic.
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.05
    ramp.color_ramp.elements[0].color = (*base, 1.0)
    ramp.color_ramp.elements[1].position = 0.95
    ramp.color_ramp.elements[1].color = (*tip, 1.0)
    links.new(sep.outputs["Y"], ramp.inputs["Fac"])

    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 6.0
    noise.inputs["Detail"].default_value = 4.0
    links.new(texco.outputs["Generated"], noise.inputs["Vector"])

    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "OVERLAY"
    mix.inputs["Factor"].default_value = 0.14
    links.new(ramp.outputs["Color"], mix.inputs[6])
    links.new(noise.outputs["Color"], mix.inputs[7])
    links.new(mix.outputs[2], bsdf.inputs["Base Color"])

    def setv(key, value):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = value

    setv("Roughness", 0.48)
    setv("Metallic", 0.0)
    setv("IOR", 1.42)
    setv("Transmission Weight", 0.10)
    setv("Subsurface Weight", 0.22)
    setv("Subsurface Radius", (0.38, 0.55, 0.20))
    setv("Subsurface Scale", 0.08)
    setv("Coat Weight", 0.10)          # waxy cuticle
    setv("Coat Roughness", 0.32)
    setv("Sheen Weight", 0.10)

    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def area_light(name, energy, size, loc, rot):
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    obj.rotation_euler = rot
    bpy.context.collection.objects.link(obj)
    return obj


def setup_scene():
    scene = bpy.context.scene

    # Cycles: EEVEE only approximates the light coming through the blade.
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.transmission_bounces = 8

    scene.render.resolution_x = TILE
    scene.render.resolution_y = TILE
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2.6
    cam = bpy.data.objects.new("Cam", cam_data)
    cam.location = (0.0, 0.0, 6.0)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    # The scene is small, so these wattages are low on purpose. Higher values
    # blow the blade out to near-white and destroy the colour entirely.
    area_light("Key", 70.0, 5.0, (2.4, -2.0, 4.0),
               (math.radians(30), math.radians(20), 0.0))
    # Behind the leaf, to light it through and pick up the subsurface.
    area_light("Rim", 110.0, 4.0, (-1.8, 1.6, -3.6),
               (math.radians(205), math.radians(-16), 0.0))
    area_light("Fill", 18.0, 7.0, (-3.0, -2.4, 2.0),
               (math.radians(45), math.radians(-30), 0.0))

    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.50, 0.66, 0.82, 1.0)
    bg.inputs["Strength"].default_value = 0.22
    scene.world = world


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_scene()
    scene = bpy.context.scene
    tmp = tempfile.mkdtemp(prefix="leafrender_")

    for row, (vname, shape, base, tip) in enumerate(VARIANTS):
        leaf = build_leaf(f"Leaf_{vname}", shape=shape)
        leaf.data.materials.append(leaf_material(f"leaf_{vname}", base, tip))

        for i in range(FRAMES):
            p = i / FRAMES
            leaf.rotation_euler = (
                # Wobble, one cycle per loop.
                math.radians(26) * math.sin(2 * math.pi * p),
                # One full turn about the long axis: face, edge, face, edge.
                2 * math.pi * p,
                # A slow lean, so successive frames are not mirror images.
                math.radians(14) * math.sin(4 * math.pi * p),
            )
            scene.render.filepath = os.path.join(tmp, f"{row}_{i:02d}.png")
            bpy.ops.render.render(write_still=True)

        bpy.data.objects.remove(leaf, do_unlink=True)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, ".leafrender"), "w") as fh:
        fh.write(tmp)
    print("RENDER_DIR", tmp)
    print("FRAMES", FRAMES, "ROWS", len(VARIANTS))


if __name__ == "__main__":
    main()
