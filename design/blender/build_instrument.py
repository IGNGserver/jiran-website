"""计然「算仪」—— Blender 构建脚本（设计源资产）。

由 design/instrument.json 生成与站点 Three.js 场景同一套几何：三道浑仪环、刻度、算珠、
墨色核心，以及按同一流场函数冻结的一帧 Token 流（点云）。渲染结果用于：
  public/og/og-*.png            社交卡片
  public/media/instrument-*.webp  首屏无 WebGL / 减少动态时的静帧

用法（Blender 5.2，Cycles）：
  blender -b -P design/blender/build_instrument.py -- --spec design/instrument.json
或在已连接的 Blender 会话里先定义全局 SPEC（dict）再执行本文件内容。

坐标约定：spec 按 Three.js 的 Y 轴向上书写；脚本把整套几何挂在一个绕 X 轴 +90° 的
根节点下，换算到 Blender 的 Z 轴向上，两边的倾角数字因此可以原样共用。
"""

import json
import math
import random
import sys

import bpy
from mathutils import Euler, Matrix, Vector, noise


def load_spec():
    if "SPEC" in globals():
        return globals()["SPEC"]
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    path = argv[argv.index("--spec") + 1] if "--spec" in argv else "design/instrument.json"
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def hex_rgba(value, alpha=1.0):
    value = value.lstrip("#")
    srgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, alpha)


# ---------------------------------------------------------------- materials

def principled(name, color, metallic=0.0, roughness=0.4, coat=0.0, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = coat
    if emission:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def token_material(pal):
    """点云材质：顶点属性 counted=0 为未计入（骨白），1 为已计入（朱砂）。"""
    mat = bpy.data.materials.new("token")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "counted"
    attr.attribute_type = "GEOMETRY"
    glow = nt.nodes.new("ShaderNodeAttribute")
    glow.attribute_name = "glow"
    glow.attribute_type = "GEOMETRY"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = hex_rgba(pal["bone"])
    mix.inputs["B"].default_value = hex_rgba(pal["cinnabar"])
    nt.links.new(attr.outputs["Fac"], mix.inputs["Factor"])
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(mix.outputs["Result"], em.inputs["Color"])
    nt.links.new(glow.outputs["Fac"], em.inputs["Strength"])
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return mat


# ---------------------------------------------------------------- geometry

def link(obj, parent):
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def ring_basis(ring):
    """环的局部坐标：Three.js 的 XZ 平面圆，再按 tilt（XYZ，度）旋转。"""
    tilt = Euler([math.radians(a) for a in ring["tilt"]], "XYZ").to_matrix().to_4x4()
    return tilt


def bead_mesh(spec):
    b = spec["bead"]
    profile = [(b["hole"], -b["height"] / 2), (b["radius"] * 0.42, -b["height"] / 2),
               (b["radius"], -b["height"] * 0.06), (b["radius"], b["height"] * 0.06),
               (b["radius"] * 0.42, b["height"] / 2), (b["hole"], b["height"] / 2)]
    seg = 48
    verts, faces = [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        for r, z in profile:
            verts.append((r * math.cos(a), r * math.sin(a), z))
    n = len(profile)
    for i in range(seg):
        j = (i + 1) % seg
        for k in range(n - 1):
            faces.append((i * n + k, j * n + k, j * n + k + 1, i * n + k + 1))
        faces.append((i * n + n - 1, j * n + n - 1, j * n, i * n))
    mesh = bpy.data.meshes.new("bead")
    mesh.from_pydata(verts, [], faces)
    for p in mesh.polygons:
        p.use_smooth = True
    return mesh


def build_ring(spec, ring, root, mats, bead):
    basis = ring_basis(ring)
    flat = Matrix.Rotation(math.pi / 2, 4, "X")  # Blender 圆环在局部 XY → 放平到 XZ
    bpy.ops.mesh.primitive_torus_add(major_radius=ring["radius"], minor_radius=ring["tube"],
                                     major_segments=384, minor_segments=18)
    torus = bpy.context.active_object
    torus.name = f"ring.{ring['id']}"
    bpy.ops.object.shade_smooth()
    torus.data.materials.append(mats["brass"])
    torus.parent = root
    torus.matrix_parent_inverse = Matrix.Identity(4)
    torus.matrix_basis = basis @ flat

    # 刻度：径向短杆，第 0 根为朱砂「起点」
    for i in range(ring["ticks"]):
        a = 2 * math.pi * i / ring["ticks"]
        long = i == 0
        length = 0.11 if long else 0.055
        bpy.ops.mesh.primitive_cube_add(size=1)
        tick = bpy.context.active_object
        tick.name = f"tick.{ring['id']}.{i:02d}"
        r = ring["radius"] + ring["tube"] + length / 2 + 0.012
        local = Matrix.Translation((r * math.cos(a), 0, -r * math.sin(a))) @ Matrix.Rotation(a, 4, "Y")
        tick.parent = root
        tick.matrix_parent_inverse = Matrix.Identity(4)
        tick.matrix_basis = basis @ local @ Matrix.Diagonal((length, 0.004, 0.004, 1))
        tick.data.materials.append(mats["cinnabar_line"] if long else mats["bone_line"])

    # 算珠：沿环切向穿线，成簇排列
    step = (spec["bead"]["height"] * 1.04) / ring["radius"]
    start = 0.35
    for i in range(ring["beads"]):
        a = start + i * step
        obj = bpy.data.objects.new(f"bead.{ring['id']}.{i:02d}", bead)
        link(obj, root)
        pos = Matrix.Translation((ring["radius"] * math.cos(a), 0, -ring["radius"] * math.sin(a)))
        # 珠子轴向（局部 Z）绕 Y 转 a 后恰好落在环的切线方向
        obj.matrix_basis = basis @ pos @ Matrix.Rotation(a, 4, "Y")


def flow_state(spec, k, u, jitter, lane):
    """单个 Token 在流场中的位置与「计入」状态。

    与 src/scripts/hero/flow.glsl 保持同一公式：t 从 0（外环来源）走到 1（墨核），
    半径线性收缩、角度按 twist 螺旋前进，噪声扰动随靠近核心而衰减；穿过 countRadius
    的那一段是「被计入」的瞬间（朱砂高亮），之后余烬渐暗。
    """
    f = spec["flow"]
    t = u
    r = f["coreRadius"] + (f["outerRadius"] - f["coreRadius"]) * (1 - t)
    theta = 2 * math.pi * k / f["sources"] + f["twist"] * math.pi * t ** 4 + lane * 0.012
    y = jitter * f["thickness"] * (1 - t) ** 2 * 0.6
    p = Vector((r * math.cos(theta), y, -r * math.sin(theta)))
    n = noise.noise_vector(p * 0.5 + Vector((0, k * 0.37, 0)))
    p += n * 0.09 * (1 - t)
    d = (f["countRadius"] - r) / 0.45
    band = math.exp(-((d - 0.35) ** 2) * 6.0) if d > -0.4 else 0.0
    inside = 1.0 if r < f["countRadius"] else 0.0
    return p, band, inside


def flow_points(spec, count, seed=7):
    f = spec["flow"]
    rng = random.Random(seed)
    pts, counted, glow = [], [], []
    for _ in range(count):
        k = rng.randrange(f["sources"])
        p, band, inside = flow_state(spec, k, rng.random(), rng.gauss(0, 1), rng.gauss(0, 1))
        pts.append(p)
        counted.append(min(1.0, band + inside * 0.7))
        base = (0.45 + 0.55 * rng.random()) * min(1.0, (f["outerRadius"] - p.length) / 1.2)
        glow.append(max(0.0, base) * (1.0 * (1 - inside) + 0.12 * inside) + band * 6.0)
    return pts, counted, glow


def build_flow(spec, root, mat, count):
    pts, counted, glow = flow_points(spec, count)
    mesh = bpy.data.meshes.new("tokens")
    mesh.from_pydata([tuple(p) for p in pts], [], [])
    a = mesh.attributes.new("counted", "FLOAT", "POINT")
    a.data.foreach_set("value", counted)
    g = mesh.attributes.new("glow", "FLOAT", "POINT")
    g.data.foreach_set("value", glow)
    obj = bpy.data.objects.new("tokens", mesh)
    link(obj, root)
    mesh.materials.append(mat)

    mod = obj.modifiers.new("points", "NODES")
    tree = bpy.data.node_groups.new("tokens_to_points", "GeometryNodeTree")
    tree.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    tree.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    nin = tree.nodes.new("NodeGroupInput")
    nout = tree.nodes.new("NodeGroupOutput")
    m2p = tree.nodes.new("GeometryNodeMeshToPoints")
    m2p.inputs["Radius"].default_value = 0.0032
    setm = tree.nodes.new("GeometryNodeSetMaterial")
    setm.inputs["Material"].default_value = mat
    tree.links.new(nin.outputs[0], m2p.inputs["Mesh"])
    tree.links.new(m2p.outputs["Points"], setm.inputs["Geometry"])
    tree.links.new(setm.outputs["Geometry"], nout.inputs[0])
    mod.node_group = tree
    return obj


# ---------------------------------------------------------------- scene

def build(spec, tokens=60000):
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for item in list(block):
            block.remove(item)

    pal = spec["palette"]
    mats = {
        "brass": principled("brass", hex_rgba(pal["brass"]), metallic=1.0, roughness=0.26),
        "bead": principled("bead", hex_rgba(pal["cinnabar"]), roughness=0.2, coat=0.8),
        "core": principled("core", hex_rgba("#030304"), roughness=0.06, coat=1.0),
        "bone_line": principled("bone_line", hex_rgba(pal["bone"]), roughness=0.5,
                                emission=hex_rgba(pal["bone"]), strength=0.6),
        "cinnabar_line": principled("cinnabar_line", hex_rgba(pal["cinnabar"]), roughness=0.5,
                                    emission=hex_rgba(pal["cinnabar"]), strength=4.0),
    }

    root = bpy.data.objects.new("jiran_instrument", None)
    bpy.context.scene.collection.objects.link(root)
    root.rotation_euler = (math.pi / 2, 0, 0)

    bead = bead_mesh(spec)
    bead.materials.append(mats["bead"])
    for ring in spec["rings"]:
        build_ring(spec, ring, root, mats, bead)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=spec["core"]["radius"], segments=96, ring_count=48)
    core = bpy.context.active_object
    core.name = "core"
    bpy.ops.object.shade_smooth()
    core.data.materials.append(mats["core"])
    core.parent = root
    core.matrix_parent_inverse = Matrix.Identity(4)

    bpy.ops.mesh.primitive_torus_add(major_radius=spec["core"]["radius"] * 1.004, minor_radius=0.0025,
                                     major_segments=256, minor_segments=8)
    seam = bpy.context.active_object
    seam.name = "core.seam"
    seam.data.materials.append(mats["cinnabar_line"])
    seam.parent = root
    seam.matrix_parent_inverse = Matrix.Identity(4)
    seam.matrix_basis = Matrix.Rotation(math.pi / 2, 4, "X")

    build_flow(spec, root, token_material(pal), tokens)
    return root


def light_and_camera(spec, aspect=1200 / 630, target=(0.0, 0.0, 0.0), distance=7.2, elevation=24.0,
                     azimuth=-18.0, lens=58.0, fstop=2.2):
    scene = bpy.context.scene
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = hex_rgba(spec["palette"]["ink"])
    bg.inputs["Strength"].default_value = 0.4

    def area(name, loc, size, energy, color, glossy=True):
        data = bpy.data.lights.new(name, "AREA")
        data.shape = "DISK"
        data.size = size
        data.energy = energy
        data.color = color[:3]
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = loc
        obj.visible_glossy = glossy
        direction = Vector(target) - Vector(loc)
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        return obj

    area("key", (-4.5, -3.5, 5.5), 4.0, 900, hex_rgba("#fff1dc"))
    area("rim", (3.5, 6.0, 2.2), 3.0, 700, hex_rgba("#cfe3ff"))
    area("ember", (0.0, -1.5, -3.0), 2.0, 140, hex_rgba(spec["palette"]["cinnabar"]), glossy=False)

    cam_data = bpy.data.cameras.new("camera")
    cam_data.lens = lens
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = fstop
    cam = bpy.data.objects.new("camera", cam_data)
    scene.collection.objects.link(cam)
    el, az = math.radians(elevation), math.radians(azimuth)
    cam.location = (distance * math.cos(el) * math.sin(az), -distance * math.cos(el) * math.cos(az),
                    distance * math.sin(el))
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.dof.focus_distance = (Vector((2.0 * math.sin(0.4), -2.0 * math.cos(0.4), 0)) - cam.location).length
    scene.camera = cam


def render(path, width, height, samples=192):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
        try:
            scene.view_settings.look = look
            break
        except TypeError:
            continue
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    SPEC_DATA = load_spec()
    build(SPEC_DATA)
    light_and_camera(SPEC_DATA)
