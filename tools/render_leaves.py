"""
Render a tumbling-leaf sprite sheet in Blender.

Run with:
    blender -b -P tools/render_leaves.py

Produces `public/images/leaves.webp`: a sheet of FRAMES columns by one row per
colour variant. Each row is one full 360-degree rotation about the leaf's long
axis, so playing a row back on a loop reads as a leaf fluttering edge-on and
flat again. Because the rotation completes exactly one turn across the row, the
loop is seamless.

The canvas layer (src/scripts/leaves.ts) picks a row per leaf and steps through
the columns, adding its own in-plane rotation and drift on top.

This is a build-time tool. The site does not depend on Blender; it ships the
rendered sheet. Re-run only to change the leaves themselves.
"""

import math
import os
import sys
import tempfile

import bpy

FRAMES = 24
TILE = 128          # rendered size; downsampled into the sheet
SHEET_TILE = 64     # size in the published sheet

# Fresh, sunlit and turning. Three variants keep a drift of leaves from
# looking like one leaf duplicated.
VARIANTS = [
    ("fresh", (0.118, 0.330, 0.075, 1.0)),
    ("light", (0.290, 0.470, 0.110, 1.0)),
    ("amber", (0.520, 0.360, 0.080, 1.0)),
]

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(PROJECT, "public", "images")


def build_leaf_mesh(name="Leaf", segments=44, across=13):
    """A leaf as a curved surface: pointed tip, rounded base, cupped midrib."""
    verts, faces = [], []

    for i in range(segments + 1):
        u = i / segments                       # 0 at base, 1 at tip
        y = -1.0 + 2.0 * u

        # Widest about a third up from the base, with a rounded base and a
        # drawn-out point. A symmetric lens shape reads as an almond, not a
        # leaf; the asymmetry is what makes the silhouette recognisable.
        # Exponents put the peak at 0.42 / (0.42 + 0.88) = 0.32 of the length.
        half = 1.42 * (u ** 0.42) * ((1.0 - u) ** 0.88) * 0.46

        # A short stem at the base.
        if u < 0.08:
            half = min(half, 0.022)

        half = max(half, 1e-4)

        for j in range(across):
            v = -1.0 + 2.0 * (j / (across - 1))   # -1 left edge, +1 right edge
            x = v * half

            # Cup the blade away from the midrib, and let the tip curl over.
            cup = 0.16 * (v * v)
            curl = 0.30 * (u ** 2.6)
            # A gentle twist along the length stops it reading as a flat cutout
            # when it turns edge-on.
            twist = 0.13 * v * math.sin(math.pi * u)
            verts.append((x, y, cup + curl + twist))

    for i in range(segments):
        for j in range(across - 1):
            a = i * across + j
            b = a + 1
            c = a + across + 1
            d = a + across
            faces.append((a, b, c, d))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    # Smooth shading, and a touch of thickness so the edge-on pose is not a
    # zero-width line.
    for poly in mesh.polygons:
        poly.use_smooth = True
    solidify = obj.modifiers.new("Solidify", "SOLIDIFY")
    solidify.thickness = 0.012
    solidify.offset = 0.0

    return obj


def make_material(name, colour):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")

    def setv(key, value):
        if bsdf and key in bsdf.inputs:
            bsdf.inputs[key].default_value = value

    setv("Base Color", colour)
    setv("Roughness", 0.46)
    setv("Metallic", 0.0)
    # Leaves glow when the sun is behind them. This is what sells them as
    # organic rather than as green plastic chips.
    setv("Subsurface Weight", 0.32)
    setv("Subsurface Radius", (0.42, 0.62, 0.22))
    setv("Sheen Weight", 0.25)
    return mat


def setup_scene():
    scene = bpy.context.scene

    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    print("engine:", scene.render.engine)

    if scene.render.engine == "CYCLES":
        scene.cycles.samples = 48

    scene.render.resolution_x = TILE
    scene.render.resolution_y = TILE
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2.5
    cam = bpy.data.objects.new("Cam", cam_data)
    cam.location = (0.0, 0.0, 6.0)
    cam.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    key_data = bpy.data.lights.new("Key", type="AREA")
    key_data.energy = 480.0
    key_data.size = 6.0
    key = bpy.data.objects.new("Key", key_data)
    key.location = (2.6, -2.2, 4.2)
    key.rotation_euler = (math.radians(32), math.radians(22), 0.0)
    bpy.context.collection.objects.link(key)

    # Behind the leaf, to light it through and pick up the subsurface.
    rim_data = bpy.data.lights.new("Rim", type="AREA")
    rim_data.energy = 260.0
    rim_data.size = 5.0
    rim = bpy.data.objects.new("Rim", rim_data)
    rim.location = (-2.2, 1.8, -3.4)
    rim.rotation_euler = (math.radians(200), math.radians(-18), 0.0)
    bpy.context.collection.objects.link(rim)

    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.55, 0.70, 0.85, 1.0)
        bg.inputs[1].default_value = 0.6
    scene.world = world


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_scene()

    leaf = build_leaf_mesh()
    tmp = tempfile.mkdtemp(prefix="leafrender_")
    scene = bpy.context.scene

    for row, (vname, colour) in enumerate(VARIANTS):
        leaf.data.materials.clear()
        leaf.data.materials.append(make_material(f"leaf_{vname}", colour))

        for i in range(FRAMES):
            p = i / FRAMES
            leaf.rotation_euler = (
                # Wobble, one cycle per loop.
                math.radians(26) * math.sin(2 * math.pi * p),
                # One full turn about the long axis: face, edge, face, edge.
                2 * math.pi * p,
                # A slow lean so successive frames are not mirror images.
                math.radians(14) * math.sin(4 * math.pi * p),
            )
            scene.render.filepath = os.path.join(tmp, f"{row}_{i:02d}.png")
            bpy.ops.render.render(write_still=True)

    print("RENDER_DIR", tmp)
    with open(os.path.join(OUT_DIR, ".leafrender"), "w") as fh:
        fh.write(tmp)


if __name__ == "__main__":
    main()
