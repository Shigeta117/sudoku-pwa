"""Render one pachinko-style logo for the effects mode and write it as WebP with a baked outline.

blender -b -P render_logo.py -- <font.ttf> <out.webp> <style> <line1> [line2]

style: gold (gold face, red walls), red (red face, gold walls), silver (chrome face, dark walls)
Called by build.mjs; see the list of logos there.
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
FONT, OUT, STYLE, LINE1 = argv[0], argv[1], argv[2], argv[3]
LINE2 = argv[4] if len(argv) > 4 else ""

STYLES = {
    # face color, face roughness, wall color, outline colors (halo, outline, edge, seam)
    "gold": ((1.0, 0.6, 0.1), 0.1, (0.55, 0.015, 0.01), ("#1a0000", "#4a0004", "#ffd76a", "#3a0000")),
    "red": ((0.9, 0.06, 0.03), 0.14, (0.75, 0.42, 0.05), ("#1a0000", "#3a0002", "#ffe08a", "#2a0000")),
    "silver": ((0.86, 0.88, 0.92), 0.12, (0.06, 0.07, 0.1), ("#000000", "#0d0f14", "#d9dee6", "#000000")),
}
FACE, FACE_ROUGH, WALL, OUTLINE = STYLES[STYLE]

# Vertical colour bands on each line's face (bottom -> top): the classic pachinko metal lettering.
# A flat metal face seen by an orthographic camera reflects one colour only, so the bands carry the look.
FACE_BANDS = {
    "gold": [(0.0, (0.75, 0.22, 0.0)), (0.4, (1.0, 0.55, 0.05)), (0.5, (0.55, 0.18, 0.0)),
             (0.56, (1.0, 0.82, 0.3)), (0.8, (1.0, 0.93, 0.6)), (1.0, (1.0, 1.0, 0.88))],
    "red": [(0.0, (0.35, 0.0, 0.0)), (0.4, (0.9, 0.05, 0.02)), (0.5, (0.4, 0.0, 0.0)),
            (0.56, (1.0, 0.3, 0.15)), (0.8, (1.0, 0.6, 0.45)), (1.0, (1.0, 0.92, 0.85))],
    "silver": [(0.0, (0.25, 0.28, 0.33)), (0.4, (0.62, 0.66, 0.72)), (0.5, (0.2, 0.22, 0.26)),
               (0.56, (0.85, 0.88, 0.93)), (0.8, (0.95, 0.97, 1.0)), (1.0, (1.0, 1.0, 1.0))],
}[STYLE]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- render settings ----------
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
for backend in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = backend
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = "GPU"
        break
    except Exception:
        continue
scene.cycles.samples = 128
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = 1200
scene.render.resolution_y = 640 if LINE2 else 400
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.0

font = bpy.data.fonts.load(FONT)


def principled(name, color, metallic, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = rough
    return m


def material_letters():
    """Face colour on surfaces facing the camera, wall colour on the extrusion; the bevel blends them."""
    m = bpy.data.materials.new("letters")
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    mix = nodes.new("ShaderNodeMixShader")
    face = nodes.new("ShaderNodeBsdfPrincipled")
    face.inputs["Metallic"].default_value = 1.0
    face.inputs["Roughness"].default_value = FACE_ROUGH
    # Generated coordinates span each object's own bounds, so every line gets the full band set
    tex = nodes.new("ShaderNodeTexCoord")
    tsep = nodes.new("ShaderNodeSeparateXYZ")
    bands = nodes.new("ShaderNodeValToRGB")
    bcr = bands.color_ramp
    bcr.elements[0].position, bcr.elements[0].color = FACE_BANDS[0][0], (*FACE_BANDS[0][1], 1)
    bcr.elements[1].position, bcr.elements[1].color = FACE_BANDS[-1][0], (*FACE_BANDS[-1][1], 1)
    for pos, col in FACE_BANDS[1:-1]:
        bcr.elements.new(pos).color = (*col, 1)
    links.new(tex.outputs["Generated"], tsep.inputs[0])
    links.new(tsep.outputs["Y"], bands.inputs["Fac"])
    links.new(bands.outputs["Color"], face.inputs["Base Color"])
    # a little self-light in the band colour keeps the face bright where the metal reflects darkness
    links.new(bands.outputs["Color"], face.inputs["Emission Color"])
    face.inputs["Emission Strength"].default_value = 0.35
    wall = nodes.new("ShaderNodeBsdfPrincipled")
    wall.inputs["Base Color"].default_value = (*WALL, 1)
    wall.inputs["Metallic"].default_value = 0.8
    wall.inputs["Roughness"].default_value = 0.22
    geo = nodes.new("ShaderNodeNewGeometry")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.55
    ramp.color_ramp.elements[0].color = (1, 1, 1, 1)
    ramp.color_ramp.elements[1].position = 0.8
    ramp.color_ramp.elements[1].color = (0, 0, 0, 1)
    links.new(geo.outputs["Normal"], sep.inputs[0])
    links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], mix.inputs["Fac"])
    links.new(face.outputs[0], mix.inputs[1])
    links.new(wall.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs[0])
    return m


def make_text(body, x, y, z, size, mat):
    bpy.ops.object.text_add(location=(x, y, z))
    ob = bpy.context.object
    ob.data.body = body
    ob.data.font = font
    ob.data.size = size
    ob.data.align_x = "CENTER"
    ob.data.align_y = "CENTER"
    ob.data.shear = 0.18
    ob.data.space_character = 0.9
    ob.data.extrude = 0.24
    ob.data.materials.append(mat)
    # The curve bevel of text spikes at acute glyph corners; bevel the mesh with clamped overlap instead
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.object
    bevel = ob.modifiers.new("bevel", "BEVEL")
    bevel.width = 0.045
    bevel.segments = 4
    bevel.limit_method = "ANGLE"
    bevel.use_clamp_overlap = True
    bevel.miter_outer = "MITER_ARC"
    bevel.harden_normals = False
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    return ob


letters = material_letters()
if LINE2:
    # Staggered: second line lower right, in front, overlapping the first a little
    make_text(LINE1, -0.22, 0.4, 0.0, 1.0, letters)
    make_text(LINE2, 0.3, -0.42, 0.12, 1.0, letters)
else:
    make_text(LINE1, 0.0, 0.0, 0.0, 1.0, letters)

bpy.ops.object.empty_add(location=(0, 0, 0))
pivot = bpy.context.object
for ob in bpy.data.objects:
    if ob.type == "MESH":
        ob.parent = pivot
pivot.rotation_euler = (math.radians(-14), math.radians(9), math.radians(3))
bpy.context.view_layer.update()

# ---------- camera: orthographic, fitted to the logo ----------
pts = []
for ob in bpy.data.objects:
    if ob.type == "MESH":
        pts += [ob.matrix_world @ Vector(c) for c in ob.bound_box]
min_x, max_x = min(p.x for p in pts), max(p.x for p in pts)
min_y, max_y = min(p.y for p in pts), max(p.y for p in pts)
aspect = scene.render.resolution_x / scene.render.resolution_y
bpy.ops.object.camera_add(location=((min_x + max_x) / 2, (min_y + max_y) / 2, 10), rotation=(0, 0, 0))
cam = bpy.context.object
cam.data.type = "ORTHO"
# room around the letters for the 2D outline baked below
cam.data.ortho_scale = max(max_x - min_x, (max_y - min_y) * aspect) * 1.16
scene.camera = cam


LIGHT_DISTANCE = 2.0  # far enough to light both lines of a two-line logo about evenly


def area(name, loc, rot, size, power, color, size_y=None):
    k = LIGHT_DISTANCE
    bpy.ops.object.light_add(type="AREA", location=[c * k for c in loc], rotation=[math.radians(r) for r in rot])
    light = bpy.context.object
    light.data.size = size * k
    if size_y:
        light.data.shape = "RECTANGLE"
        light.data.size_y = size_y * k
    light.data.energy = power * k * k
    light.data.color = color


COLD = STYLE == "silver"
area("key", (-3, 3, 5), (-35, -30, 0), 3, 380, (0.85, 0.92, 1.0) if COLD else (1.0, 0.92, 0.8))
area("rim", (4, -2, 2), (60, 50, 0), 3, 450, (0.3, 0.55, 1.0) if COLD else (1.0, 0.2, 0.05))
area("strip", (0, 3, 4), (-40, 0, 0), 10, 320, (0.95, 0.97, 1.0) if COLD else (1.0, 0.95, 0.85), size_y=0.3)
area("fill", (0, -4, 4), (45, 0, 0), 6, 80, (0.5, 0.6, 0.8) if COLD else (1.0, 0.6, 0.3))

# Environment with hard horizon bands so the metal shows dark and bright reflections
world = bpy.data.worlds.new("world")
scene.world = world
world.use_nodes = True
wn, wl = world.node_tree.nodes, world.node_tree.links
coord = wn.new("ShaderNodeTexCoord")
sep = wn.new("ShaderNodeSeparateXYZ")
maprange = wn.new("ShaderNodeMapRange")
maprange.inputs["From Min"].default_value = -1.0
maprange.inputs["From Max"].default_value = 1.0
ramp = wn.new("ShaderNodeValToRGB")
cr = ramp.color_ramp
stops = [
    (0.0, (0.0, 0.0, 0.0)),
    (0.42, (0.25, 0.02, 0.0)),
    (0.49, (0.02, 0.0, 0.0)),
    (0.5, (1.0, 0.9, 0.6)),
    (0.53, (0.05, 0.01, 0.0)),
    (0.7, (0.9, 0.4, 0.05)),
    (0.85, (0.05, 0.01, 0.0)),
    (1.0, (1.0, 0.95, 0.8)),
]
if COLD:
    # same bands in steel blue and white, so chrome reads cold instead of bronze
    stops = [(pos, (max(c) * 0.75, max(c) * 0.85, max(c))) for pos, c in stops]
cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1)
cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*stops[-1][1], 1)
for pos, col in stops[1:-1]:
    cr.elements.new(pos).color = (*col, 1)
wl.new(coord.outputs["Generated"], sep.inputs[0])
wl.new(sep.outputs["Y"], maprange.inputs["Value"])
wl.new(maprange.outputs["Result"], ramp.inputs["Fac"])
wl.new(ramp.outputs["Color"], wn["Background"].inputs["Color"])

raw_path = OUT + ".raw.png"
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = raw_path
bpy.ops.render.render(write_still=True)

# ---------- bake the outline in 2D: round dilation of the silhouette, no bevel spikes ----------
raw = bpy.data.images.load(raw_path)
w, h = raw.size
px = np.array(raw.pixels[:], dtype=np.float32).reshape(h, w, 4)
alpha = px[:, :, 3]


def dilate(a, radius):
    out = a.copy()
    for deg in range(0, 360, 8):
        dx = int(round(math.cos(math.radians(deg)) * radius))
        dy = int(round(math.sin(math.radians(deg)) * radius))
        shifted = np.roll(np.roll(a, dy, axis=0), dx, axis=1)
        np.maximum(out, shifted, out=out)
    return out


def hex_rgb(code):
    return np.array([int(code[i:i + 2], 16) / 255 for i in (1, 3, 5)], dtype=np.float32)


canvas = np.zeros((h, w, 4), dtype=np.float32)


def over(rgb, a):
    a = a[:, :, None]
    canvas[:, :, :3] = rgb * a + canvas[:, :, :3] * (1 - a)
    canvas[:, :, 3:] = a + canvas[:, :, 3:] * (1 - a)


halo, outline, edge, seam = OUTLINE
over(hex_rgb(halo), dilate(alpha, 20) * 0.85)
over(hex_rgb(outline), dilate(alpha, 14))
over(hex_rgb(edge), dilate(alpha, 5))
over(hex_rgb(seam), dilate(alpha, 2))
# straight (non-premultiplied) logo pixels over the outline
a = alpha[:, :, None]
canvas[:, :, :3] = px[:, :, :3] * a + canvas[:, :, :3] * (1 - a)
canvas[:, :, 3:] = a + canvas[:, :, 3:] * (1 - a)

# canvas colour is premultiplied by alpha; images store straight colour
covered = canvas[:, :, 3:] > 1e-4
canvas[:, :, :3] = np.where(covered, canvas[:, :, :3] / np.maximum(canvas[:, :, 3:], 1e-4), 0)

final = bpy.data.images.new("final", w, h, alpha=True)
final.pixels = canvas.ravel()
final.filepath_raw = OUT
final.file_format = "WEBP"
final.save(filepath=OUT, quality=88)
os.remove(raw_path)
print("WROTE", OUT, w, h)
