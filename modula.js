$().ready(function() {
    var scene, renderer, camera, light,
        render_size = 1000,
        camera_size = 1000;
    var group_atom = new THREE.Group(),
        group_bond = new THREE.Group(),
        group_face = new THREE.Group();
    var bond_kind = new Array(),
        face,
        mouse,
        raycaster,
        objects = [],
        scale_ceof;
    init();
    var structure_id = location.href.split('id=')[1];
    $.getScript('/bdm/datafile/' + structure_id + '/position.js', function() {
        scale_ceof = scale_position;
        for (key in atom_list) {
            var atom = atom_list[key];
            var message = element[atom[0]];
            var geometry = new THREE.SphereGeometry(message.radius, 20, 20);
            var material = new THREE.MeshPhongMaterial({
                color: new THREE.Color(message.color[0], message.color[1], message.color[2]),
                emissive: 0x444444,
                emissiveIntensity: 0.1,
                shininess: 60,
                transparent: true,
                opacity: 1,
            });
            var cube = new THREE.Mesh(geometry, material);
            cube.position.set(atom[1][0], atom[1][1], atom[1][2]);
            group_atom.add(cube);
            objects.push(cube);
        }
        // construct bond
        for (bond_key in bond_list) {
            // console.log(bond_key);
            var a = atom_list[bond_list[bond_key][0]],
                b = atom_list[bond_list[bond_key][1]];
            var dis = distance(a[1], b[1]),
                ra = element[a[0]].radius,
                rb = element[b[0]].radius,
                ca = element[a[0]].color,
                cb = element[b[0]].color;
            var bond_length = dis - ra / 2 - rb / 2,
                ceof1 = 0.5 * (dis - ra + rb) / dis,
                ceof2 = 0.5 * (dis + ra - rb) / dis;
            var position = [ceof1 * a[1][0] + ceof2 * b[1][0], ceof1 * a[1][1] + ceof2 * b[1][1], ceof1 * a[1][2] + ceof2 * b[1][2]];
            var geometry = new THREE.CylinderGeometry(bond_radius, bond_radius, bond_length, 8, 2),
                material = new THREE.MeshPhongMaterial({
                    vertexColors: THREE.FaceColors,
                    overdraw: 0.5,
                    transparent: true,
                    opacity: 1,
                    emissive: 0x444444,
                    emissiveIntensity: 0.1,
                });
            for (var i = 0; i < 32; i += 4) {
                geometry.faces[i].color.setRGB(ca[0], ca[1], ca[2]);
                geometry.faces[i + 1].color.setRGB(ca[0], ca[1], ca[2]);
                geometry.faces[i + 2].color.setRGB(cb[0], cb[1], cb[2]);
                geometry.faces[i + 3].color.setRGB(cb[0], cb[1], cb[2]);
            }
            var cube = new THREE.Mesh(geometry, material),
                vector = new THREE.Vector3(b[1][0] - a[1][0], b[1][1] - a[1][1], b[1][2] - a[1][2]);
            cube.position.set(position[0], position[1], position[2]);
            if (vector.y > 0)
                var theta = Math.atan(vector.z / vector.y) + Math.PI;
            else
                var theta = Math.atan(vector.z / vector.y)
            var beta = Math.atan(vector.x / Math.sqrt(vector.y * vector.y + vector.z * vector.z));
            cube.rotation.set(theta, 0, beta);
            group_bond.add(cube);
        }
        // construct surface
        var face_geometry = new THREE.Geometry();
        for (i in atom_list) {
            let unit_atom = atom_list[i][1];
            let vertex = new THREE.Vector3(unit_atom[0], unit_atom[1], unit_atom[2]);
            face_geometry.vertices.push(vertex);
        }
        for (face_key in face_list) {
            var center_index = face_list[face_key][0];
            unit_color = element[atom_list[center_index][0]].color;
            for (i in face_list[face_key][1]) {
                var a_index = face_list[face_key][1][i][0],
                    b_index = face_list[face_key][1][i][1],
                    c_index = face_list[face_key][1][i][2];
                var normal = vcross(translation_del(atom_list[b_index][1], atom_list[a_index][1]), translation_del(atom_list[c_index][1], atom_list[a_index][1]));
                var normal_init = new THREE.Vector3(normal[0], normal[1], normal[2]);
                var unit_face = new THREE.Face3(a_index, b_index, c_index, normal_init);
                unit_face.color.setRGB(unit_color[0], unit_color[1], unit_color[2]);
                face_geometry.faces.push(unit_face);
            }
        }
        var face_material = new THREE.MeshPhongMaterial({
            vertexColors: THREE.FaceColors,
            overdraw: 0.5,
            transparent: true,
            opacity: 1,
            emissive: 0x888888,
            emissiveIntensity: 0.1,
            side: 2,
            alphaTest: 0.5,
        })
        face = new THREE.Mesh(face_geometry, face_material);
        group_face.add(face);
        create_axis();
        create_crystal_frame();
    });
    scene.add(group_atom);
    scene.add(group_bond);
    render();
    animate();
    add_mouseevent();
    var $face_dom = $('<button></button>'),
        $bond_dom = $('<button></button>');
    $face_dom.html('Show polyhedrons');
    $face_dom.addClass('control_3d');
    $bond_dom.addClass('control_3d');
    $face_dom.on('click', function() {
        var text = $(this).html();
        if (text != 'Hide polyhedrons') {
            scene.add(group_face);
            $(this).html('Hide polyhedrons');
        } else {
            scene.remove(group_face);
            $face_dom.html('Show polyhedrons');
        }
    })
    $bond_dom.html('Hide bonds');
    $bond_dom.on('click', function() {
        var text = $(this).html();
        if (text == 'Hide bonds') {
            scene.remove(group_bond);
            $(this).html('Show bonds');
        } else {
            scene.add(group_bond);
            $(this).html('Hide bonds');
        }
    })
    $('#model').append($face_dom, $bond_dom);

    function init() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);
        camera = new THREE.OrthographicCamera(-500, 500, 500, -500, 1, 4000);
        camera.position.set(0, 0, 2000);
        camera.lookAt(new THREE.Vector3(0, 0, 0));
        renderer = new THREE.WebGLRenderer();
        renderer.setSize(500, 500);
        renderer.setPixelRatio(window.devicePixelRatio);
        light = new THREE.DirectionalLight(0xffffff, 1.1);
        light.position.set(0, 0, 1).normalize();
        scene.add(light);
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        $('#canvas').append(renderer.domElement);
    }

    function render() {
        camera.updateProjectionMatrix();
        renderer.render(scene, camera)
    }

    function animate() {
        requestAnimationFrame(animate);
        render();
    }

    function create_axis() {
        arrow_axis = new THREE.Group();
        var position = new THREE.Vector3(0, 0, 0),
            Helper_a = new THREE.Vector3(vector_a[0], vector_a[1], vector_a[2]).normalize(),
            Helper_b = new THREE.Vector3(vector_b[0], vector_b[1], vector_a[2]).normalize(),
            Helper_c = new THREE.Vector3(vector_c[0], vector_c[1], vector_c[2]).normalize();
        var arrowHelper_a = new THREE.ArrowHelper(Helper_a, position, 100, 0xff0000),
            arrowHelper_b = new THREE.ArrowHelper(Helper_b, position, 100, 0x00ff00),
            arrowHelper_c = new THREE.ArrowHelper(Helper_c, position, 100, 0x0000ff);
        arrow_axis.add(arrowHelper_a);
        arrow_axis.add(arrowHelper_b);
        arrow_axis.add(arrowHelper_c);
        var center = new THREE.Mesh(new THREE.SphereGeometry(20, 20, 20), new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: 0x444444,
            emissiveIntensity: 0.1,
            shininess: 60,
            transparent: true,
            opacity: 1,
        }));
        arrow_axis.add(center);
        arrow_axis.position.set(-400, -400, 0)
        scene.add(arrow_axis);

    }

    function create_crystal_frame() {
        var crystal_axis = new THREE.Group(),
            line_geometry = new THREE.Geometry(),
            vertex_list = [];
        for (var i = 0; i < 2; i++) {
            for (var j = 0; j < 2; j++) {
                for (var k = 0; k < 2; k++) {
                    var x = i * vector_a[0] + j * vector_b[0] + k * vector_c[0] - translation_vector[0],
                        y = i * vector_a[1] + j * vector_b[1] + k * vector_c[1] - translation_vector[1],
                        z = i * vector_a[2] + j * vector_b[2] + k * vector_c[2] - translation_vector[2];
                    var vertex = new THREE.Vector3(x, y, z);
                    vertex_list.push(vertex);
                }
            }
        }
        var line_material = new THREE.LineBasicMaterial({
            color: 0x000000,
        })
        var connect_list = [0, 1, 0, 2, 0, 4, 1, 3, 1, 5, 2, 3, 2, 6, 4, 5, 4, 6, 3, 7, 5, 7, 6, 7];
        for (var i = 0; i < connect_list.length; i++) {
            line_geometry.vertices.push(vertex_list[connect_list[i]]);
        }
        var line = new THREE.LineSegments(line_geometry, line_material);
        group_atom.add(line);
    }

    function vcross(p1, p2) {
        var x = p1[1] * p2[2] - p1[2] * p2[1],
            y = p1[2] * p2[0] - p1[0] * p2[2],
            z = p1[0] * p2[1] - p1[1] * p2[0];
        return [x, y, z]
    }

    function vdot(p1, p2) {
        var sum = 0;
        p1.forEach(function(value, index) {
            sum += value * p2[index]
        })
        return sum;
    }

    function translation_del(p1, p2) {
        return p1.map(function(value, index) {
            return p2[index] - p1[index]
        })
    }

    function distance(p1, p2) {
        if (p1.x) {
            var sum = Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2);
            return Math.sqrt(sum)
        } else {
            p2 = p2 || [0, 0, 0];
            var sum = 0;
            for (var i = 0; i < 3; i++) {
                sum += Math.pow(p1[i] - p2[i], 2);
            }
            return Math.sqrt(sum)
        }
    }

    function add_mouseevent() {
        $('#canvas>canvas').on('mousewheel', function(event, delta) {
            event.preventDefault();
            event.stopPropagation();
            var add = delta < 0 ? -0.05 : 0.05,
                state = group_atom.scale.x + add;
            if (state > 0.2 && state < 3) {
                group_atom.scale.set(state, state, state);
                group_bond.scale.set(state, state, state);
                group_face.scale.set(state, state, state);
            }
            render();
            return false;
        });

        var unit = [];
        $('#canvas').on('mousedown', function(event) {
            var state = event.button;
            event.stopPropagation();
            event.preventDefault();
            var radius = 200;
            var x0 = event.pageX,
                y0 = event.pageY,
                group_px = group_atom.position.x,
                group_py = group_atom.position.y,
                axis_x = new THREE.Vector3(1, 0, 0),
                axis_y = new THREE.Vector3(0, 1, 0);
            mouse.x = (event.offsetX / renderer.domElement.clientWidth) * 2 - 1;
            mouse.y = -(event.offsetY / renderer.domElement.clientHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            var intersects = raycaster.intersectObjects(objects);
            if (intersects.length > 0) {
                if (unit.length != 2) {
                    unit.push(intersects[0].object);
                    if (unit.length == 2) {
                        let bond_length = distance(unit[0].position, unit[1].position) / scale_ceof;
                        $('#distance').html('Distance of two selected atoms is ' + bond_length.toFixed(3) + ' Å');
                    }
                    intersects[0].object.material.emissiveIntensity = 2;
                } else {
                    unit[0].material.emissiveIntensity = 0.1;
                    unit.shift();
                    unit.push(intersects[0].object);
                    intersects[0].object.material.emissiveIntensity = 2;
                    let bond_length = distance(unit[0].position, unit[1].position) / scale_ceof;
                    $('#distance').html('Distance of two selected atoms is ' + bond_length.toFixed(3) + ' Å');
                }

            } else {
                for (i in unit) {
                    unit[i].material.emissiveIntensity = 0.1;
                }
            }

            if (state == 0) {
                $('#canvas').on('mousemove', function(event) {
                    var x = event.pageX,
                        y = event.pageY;
                    group_atom.rotateOnWorldAxis(axis_y, (x - x0) / radius);
                    group_atom.rotateOnWorldAxis(axis_x, (y - y0) / radius);
                    group_bond.rotateOnWorldAxis(axis_y, (x - x0) / radius);
                    group_bond.rotateOnWorldAxis(axis_x, (y - y0) / radius);
                    group_face.rotateOnWorldAxis(axis_y, (x - x0) / radius);
                    group_face.rotateOnWorldAxis(axis_x, (y - y0) / radius);
                    arrow_axis.rotateOnWorldAxis(axis_y, (x - x0) / radius);
                    arrow_axis.rotateOnWorldAxis(axis_x, (y - y0) / radius);
                    render();
                    x0 = x, y0 = y;
                })
            } else {
                $('#canvas').on('mousemove', function(event) {
                    var x = event.pageX,
                        y = event.pageY;
                    group_atom.position.x += (x - x0) / 2;
                    group_atom.position.y += (y0 - y) / 2;
                    group_bond.position.x += (x - x0) / 2;
                    group_bond.position.y += (y0 - y) / 2;
                    group_face.position.x += (x - x0) / 2;
                    group_face.position.y += (y0 - y) / 2;
                    render();
                    x0 = x, y0 = y;
                })
            }
            $('#canvas').on('mouseup', function() {
                $('#canvas').off('mousemove');
                $('#canvas').off('mouseup');
                $('#canvas').off('mouseout');
            });
            $('#canvas').on('mouseout', function() {
                $('#canvas').off('mousemove');
                $('#canvas').off('mouseup');
                $('#canvas').off('mouseout');
            })
        }).on('contextmenu', function() {
            return false;
        })
    }
})