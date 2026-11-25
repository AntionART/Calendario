# -*- coding: utf-8 -*-
"""Genera INSTALAR.pptx y MANUAL-USO.pptx a partir del contenido de Final/*.md,
con la paleta de marca NEUROCOOP (naranja) usada en el resto de la app."""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'Final')

PRIMARY = RGBColor(0xF9, 0x73, 0x16)
PRIMARY_DK = RGBColor(0xEA, 0x58, 0x0C)
PRIMARY_LT = RGBColor(0xFE, 0xD7, 0xAA)
PRIMARY_XL = RGBColor(0xFF, 0xF7, 0xED)
TEXT = RGBColor(0x11, 0x18, 0x27)
MUTED = RGBColor(0x6B, 0x72, 0x80)
BORDER = RGBColor(0xE5, 0xE7, 0xEB)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)


def new_presentation():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    return prs


def blank_slide(prs, bg=WHITE):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = bg
    return slide


def add_header(slide, kicker, title):
    kicker_box = slide.shapes.add_textbox(Inches(0.7), Inches(0.4), Inches(11.9), Inches(0.4))
    kf = kicker_box.text_frame
    kf.text = kicker.upper()
    kf.paragraphs[0].font.size = Pt(14)
    kf.paragraphs[0].font.bold = True
    kf.paragraphs[0].font.color.rgb = PRIMARY_DK

    title_box = slide.shapes.add_textbox(Inches(0.65), Inches(0.75), Inches(12), Inches(0.9))
    tf = title_box.text_frame
    tf.text = title
    tf.paragraphs[0].font.size = Pt(32)
    tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].font.color.rgb = TEXT

    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.55), Inches(1.4), Pt(4))
    line.fill.solid()
    line.fill.fore_color.rgb = PRIMARY
    line.line.fill.background()


def add_footer(slide, text='Calendario NEUROCOOP'):
    box = slide.shapes.add_textbox(Inches(0.7), Inches(7.05), Inches(12), Inches(0.35))
    tf = box.text_frame
    tf.text = text
    tf.paragraphs[0].font.size = Pt(10)
    tf.paragraphs[0].font.color.rgb = MUTED


def title_slide(prs, title, subtitle):
    slide = blank_slide(prs, PRIMARY)
    dot = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(0.9), Inches(2.55), Inches(0.35), Inches(0.35))
    dot.fill.solid()
    dot.fill.fore_color.rgb = WHITE
    dot.line.fill.background()

    kicker = slide.shapes.add_textbox(Inches(1.4), Inches(2.5), Inches(10), Inches(0.5))
    kf = kicker.text_frame
    kf.text = 'NEUROCOOP'
    kf.paragraphs[0].font.size = Pt(20)
    kf.paragraphs[0].font.bold = True
    kf.paragraphs[0].font.color.rgb = WHITE

    title_box = slide.shapes.add_textbox(Inches(0.9), Inches(3.1), Inches(11.5), Inches(1.6))
    tf = title_box.text_frame
    tf.word_wrap = True
    tf.text = title
    tf.paragraphs[0].font.size = Pt(48)
    tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].font.color.rgb = WHITE

    sub_box = slide.shapes.add_textbox(Inches(0.9), Inches(4.6), Inches(11), Inches(0.8))
    sf = sub_box.text_frame
    sf.word_wrap = True
    sf.text = subtitle
    sf.paragraphs[0].font.size = Pt(20)
    sf.paragraphs[0].font.color.rgb = PRIMARY_XL
    return slide


def bullet_slide(prs, kicker, title, bullets, note=None):
    slide = blank_slide(prs)
    add_header(slide, kicker, title)

    box = slide.shapes.add_textbox(Inches(0.75), Inches(2.0), Inches(11.8), Inches(4.6))
    tf = box.text_frame
    tf.word_wrap = True

    for i, item in enumerate(bullets):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        if isinstance(item, tuple):
            bold_part, rest = item
            r1 = p.add_run()
            r1.text = '●  ' + bold_part
            r1.font.bold = True
            r1.font.size = Pt(18)
            r1.font.color.rgb = TEXT
            if rest:
                r2 = p.add_run()
                r2.text = '  ' + rest
                r2.font.size = Pt(18)
                r2.font.color.rgb = MUTED
        else:
            p.text = '●  ' + item
            p.font.size = Pt(18)
            p.font.color.rgb = TEXT
        p.space_after = Pt(14)

    if note:
        note_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.75), Inches(6.15), Inches(11.8), Inches(0.75))
        note_box.fill.solid()
        note_box.fill.fore_color.rgb = PRIMARY_XL
        note_box.line.color.rgb = PRIMARY_LT
        note_box.line.width = Pt(1)
        ntf = note_box.text_frame
        ntf.word_wrap = True
        ntf.margin_left = Inches(0.2)
        ntf.margin_right = Inches(0.2)
        ntf.text = note
        ntf.paragraphs[0].font.size = Pt(13)
        ntf.paragraphs[0].font.color.rgb = PRIMARY_DK
    else:
        add_footer(slide)
    return slide


def steps_slide(prs, kicker, title, steps, note=None):
    slide = blank_slide(prs)
    add_header(slide, kicker, title)

    y = 2.0
    for i, step in enumerate(steps, start=1):
        circle = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(0.75), Inches(y), Inches(0.5), Inches(0.5))
        circle.fill.solid()
        circle.fill.fore_color.rgb = PRIMARY
        circle.line.fill.background()
        ctf = circle.text_frame
        ctf.text = str(i)
        ctf.paragraphs[0].font.size = Pt(18)
        ctf.paragraphs[0].font.bold = True
        ctf.paragraphs[0].font.color.rgb = WHITE
        ctf.paragraphs[0].alignment = PP_ALIGN.CENTER

        text_box = slide.shapes.add_textbox(Inches(1.45), Inches(y - 0.02), Inches(11.1), Inches(0.8))
        tbf = text_box.text_frame
        tbf.word_wrap = True
        tbf.text = step
        tbf.paragraphs[0].font.size = Pt(17)
        tbf.paragraphs[0].font.color.rgb = TEXT
        y += 0.85

    if note:
        note_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.75), Inches(6.15), Inches(11.8), Inches(0.75))
        note_box.fill.solid()
        note_box.fill.fore_color.rgb = PRIMARY_XL
        note_box.line.color.rgb = PRIMARY_LT
        note_box.line.width = Pt(1)
        ntf = note_box.text_frame
        ntf.word_wrap = True
        ntf.margin_left = Inches(0.2)
        ntf.margin_right = Inches(0.2)
        ntf.text = note
        ntf.paragraphs[0].font.size = Pt(13)
        ntf.paragraphs[0].font.color.rgb = PRIMARY_DK
    else:
        add_footer(slide)
    return slide


def two_col_slide(prs, kicker, title, col1_title, col1_bullets, col2_title, col2_bullets):
    slide = blank_slide(prs)
    add_header(slide, kicker, title)

    def column(x, heading, items, accent):
        box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(2.0), Inches(5.8), Inches(4.6))
        box.fill.solid()
        box.fill.fore_color.rgb = PRIMARY_XL if accent else RGBColor(0xF8, 0xFA, 0xFC)
        box.line.color.rgb = PRIMARY_LT if accent else BORDER
        box.line.width = Pt(1.5)

        h_box = slide.shapes.add_textbox(Inches(x + 0.35), Inches(2.2), Inches(5.1), Inches(0.5))
        hf = h_box.text_frame
        hf.text = heading
        hf.paragraphs[0].font.size = Pt(20)
        hf.paragraphs[0].font.bold = True
        hf.paragraphs[0].font.color.rgb = PRIMARY_DK if accent else TEXT

        t_box = slide.shapes.add_textbox(Inches(x + 0.35), Inches(2.85), Inches(5.15), Inches(3.6))
        tf = t_box.text_frame
        tf.word_wrap = True
        for i, item in enumerate(items):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.text = '· ' + item
            p.font.size = Pt(15)
            p.font.color.rgb = TEXT
            p.space_after = Pt(10)

    column(0.75, col1_title, col1_bullets, True)
    column(6.75, col2_title, col2_bullets, False)
    add_footer(slide)
    return slide


def table_slide(prs, kicker, title, headers, rows):
    slide = blank_slide(prs)
    add_header(slide, kicker, title)

    n_rows = len(rows) + 1
    n_cols = len(headers)
    left = Inches(0.75)
    top = Inches(2.1)
    width = Inches(11.8)
    height = Inches(0.55) * n_rows

    graphic_frame = slide.shapes.add_table(n_rows, n_cols, left, top, width, height)
    table = graphic_frame.table

    widths = [Inches(2.0)] + [Inches((11.8 - 2.0) / (n_cols - 1))] * (n_cols - 1)
    for i, w in enumerate(widths):
        table.columns[i].width = w

    for c, h in enumerate(headers):
        cell = table.cell(0, c)
        cell.text = h
        cell.fill.solid()
        cell.fill.fore_color.rgb = PRIMARY
        p = cell.text_frame.paragraphs[0]
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = WHITE

    for r, row in enumerate(rows, start=1):
        for c, val in enumerate(row):
            cell = table.cell(r, c)
            cell.text = val
            cell.fill.solid()
            cell.fill.fore_color.rgb = PRIMARY_XL if r % 2 == 0 else WHITE
            p = cell.text_frame.paragraphs[0]
            p.font.size = Pt(12.5)
            p.font.color.rgb = TEXT

    add_footer(slide)
    return slide


def closing_slide(prs, title, subtitle):
    slide = blank_slide(prs, PRIMARY_DK)
    title_box = slide.shapes.add_textbox(Inches(0.9), Inches(3.0), Inches(11.5), Inches(1.2))
    tf = title_box.text_frame
    tf.text = title
    tf.paragraphs[0].font.size = Pt(40)
    tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].font.color.rgb = WHITE

    sub_box = slide.shapes.add_textbox(Inches(0.9), Inches(4.0), Inches(11), Inches(1.0))
    sf = sub_box.text_frame
    sf.word_wrap = True
    sf.text = subtitle
    sf.paragraphs[0].font.size = Pt(18)
    sf.paragraphs[0].font.color.rgb = PRIMARY_LT
    return slide


# ============================================================
# INSTALAR.pptx
# ============================================================

def build_instalar():
    prs = new_presentation()

    title_slide(
        prs,
        'Calendario NEUROCOOP',
        'Guía de instalación de la app de escritorio'
    )

    bullet_slide(
        prs, 'Introducción', 'Qué es esta app',
        [
            ('App de escritorio, ', 'no una página web que hay que arrancar a mano.'),
            ('Sin código, sin Node.js, sin consola (cmd), sin archivos .bat.'),
            ('Se controla desde un ícono en la bandeja del sistema (junto al reloj de Windows).'),
            ('Arranca el calendario, mantiene el acceso por internet y hace copias de seguridad, todo en un solo lugar.'),
        ]
    )

    table_slide(
        prs, 'Contenido', 'Qué incluye la carpeta "Final"',
        ['Archivo / carpeta', 'Qué es'],
        [
            ['CalendarioNeurocoop-Setup-1.0.0.exe', 'Instalador (forma recomendada)'],
            ['CalendarioNeurocoop-Portable/', 'Version portable, sin instalar nada'],
            ['CREDENCIALES.md', 'Contraseña del panel y notas de acceso'],
            ['MANUAL-USO.md', 'Guía de uso diario del panel'],
            ['INSTALAR.md', 'Guía de instalación (este documento)'],
        ]
    )

    steps_slide(
        prs, 'Opción A', 'Instalar (recomendado)',
        [
            'Doble clic en CalendarioNeurocoop-Setup-1.0.0.exe',
            'No requiere permisos de administrador — se instala en la carpeta del usuario actual.',
            'Al terminar, queda accesible desde el menú de inicio y el escritorio como "Calendario NEUROCOOP".',
            'Al abrirlo por primera vez, se coloca en la bandeja del sistema y arranca el calendario solo.',
        ],
        note='Actualización sobre una instalación anterior: la base de datos y los archivos adjuntos existentes NUNCA se borran ni se sobrescriben.'
    )

    steps_slide(
        prs, 'Opción B', 'Versión portable (sin instalar)',
        [
            'Copiar la carpeta CalendarioNeurocoop-Portable/ a donde se quiera (incluso un USB).',
            'Ejecutar "Calendario NEUROCOOP.exe" dentro de esa carpeta.',
            'Funciona igual que la version instalada, pero no crea accesos directos ni se registra para iniciar con Windows.',
        ],
        note='Util para una prueba rapida o un equipo donde no se quiere dejar el programa registrado.'
    )

    bullet_slide(
        prs, 'Primeros pasos', 'Uso diario, en breve',
        [
            ('Ícono de bandeja: ', 'clic para abrir el panel de administración.'),
            ('Desde el panel: ', 'iniciar/detener/reiniciar, ver logs, backups, túnel a internet, autoarranque.'),
            ('Calendario público: ', 'botón "Abrir en navegador" o http://localhost:8765/'),
            ('Gestión de contenido: ', 'http://localhost:8765/gestion, con la contraseña de CREDENCIALES.md'),
        ],
        note='Ver MANUAL-USO.pptx / MANUAL-USO.md para el detalle completo de cada pestaña del panel.'
    )

    bullet_slide(
        prs, 'Desinstalar', 'Cómo quitar el programa',
        [
            'Desde "Agregar o quitar programas" de Windows, buscar "Calendario NEUROCOOP".',
            'Pregunta explícitamente si también se desean borrar los datos del calendario.',
            'Por defecto conviene decir que NO, así se conservan si se reinstala más adelante.',
        ]
    )

    closing_slide(prs, 'Listo para instalar', 'Cualquier duda, ver MANUAL-USO.md o CREDENCIALES.md')

    out_path = os.path.join(OUT_DIR, 'INSTALAR.pptx')
    prs.save(out_path)
    print('Generado:', out_path)


# ============================================================
# MANUAL-USO.pptx
# ============================================================

def build_manual_uso():
    prs = new_presentation()

    title_slide(
        prs,
        'Manual de uso',
        'Panel de administración — Calendario NEUROCOOP'
    )

    bullet_slide(
        prs, 'Lo más importante', 'A partir de ahora, todo se maneja desde la app',
        [
            'Ya no hace falta abrir VSCode, la consola (cmd), ni ejecutar INICIAR.bat / INICIAR-INTERNET.bat.',
            'Tampoco hace falta una ventana de ngrok aparte.',
            'La app de escritorio arranca el calendario, mantiene la conexión a internet y hace las copias de seguridad, todo desde el ícono de la bandeja.',
        ]
    )

    two_col_slide(
        prs, 'Paneles', 'Los dos paneles (no confundir)',
        'Panel de escritorio (bandeja)',
        [
            'Controla el PROGRAMA',
            'Iniciar / detener / reiniciar',
            'Logs, backups, túnel',
            'Puerto y autoarranque',
            'Se abre con el ícono naranja de la bandeja',
        ],
        'Panel web de gestión (/gestion)',
        [
            'Administra el CONTENIDO',
            'Crear/editar/borrar eventos',
            'Sedes, logo, colores',
            'Cambiar la contraseña',
            'http://localhost:8765/gestion (pide contraseña)',
        ]
    )

    bullet_slide(
        prs, 'Pestaña Estado', 'Control del servidor y enlaces de acceso',
        [
            ('En ejecución / Detenido: ', 'estado actual y tiempo activo.'),
            ('Iniciar / Detener / Reiniciar: ', 'controlan el proceso del servidor.'),
            ('Enlaces de acceso: ', 'URL local, de red interna y de internet, cada una con botón "Copiar".'),
            ('Túnel de acceso remoto: ', 'activa/desactiva ngrok con la URL fija ya configurada.'),
        ],
        note='Requiere ngrok instalado en C:\\ngrok\\ngrok.exe con el túnel "calendario" ya configurado (eso no lo gestiona la app).'
    )

    bullet_slide(
        prs, 'Pestaña Logs', 'Qué está pasando ahora mismo',
        [
            'Últimas líneas de actividad del servidor: arranques, errores, backups.',
            'Botón "Actualizar" para refrescar.',
            'Es el primer lugar para mirar si algo no funciona.',
        ]
    )

    bullet_slide(
        prs, 'Pestaña Copias de seguridad', 'Crear, exportar, importar, restaurar',
        [
            ('Crear copia ahora: ', 'guarda una copia con fecha/hora en la carpeta configurada.'),
            ('Exportar a otra carpeta...: ', 'elegís vos dónde guardarla (USB, red).'),
            ('Importar desde archivo...: ', 'reemplaza la base de datos actual por cualquier .db elegido.'),
            ('Copias existentes: ', 'lista con botón "Restaurar" en cada una.'),
        ],
        note='Recomendado: además de las copias automáticas, exportar de vez en cuando a un USB o carpeta de red.'
    )

    bullet_slide(
        prs, 'Pestaña Configuración', 'Ajustes del programa',
        [
            ('Puerto del servidor: ', 'por defecto 8765. Cambiarlo requiere reiniciar el servidor.'),
            ('Iniciar con Windows: ', 'para que arranque solo al iniciar sesión.'),
            ('Backups automáticos: ', 'activar, definir cada cuántas horas, y cuántas copias conservar.'),
        ]
    )

    steps_slide(
        prs, 'Emergencia', 'Se dañó o se perdieron datos: qué hacer',
        [
            'Abrir el panel → Copias de seguridad.',
            'Si hay una copia reciente, clic en "Restaurar" al lado de la más cercana al problema.',
            'Si la copia está en otro lado, usar "Importar copia desde archivo..." y elegirla.',
            'Confirmar la advertencia — el programa detiene el servidor, reemplaza la base de datos y reinicia solo.',
            'Verificar en http://localhost:8765/ que los eventos volvieron a aparecer.',
        ]
    )

    bullet_slide(
        prs, 'Ayuda', 'Problemas comunes',
        [
            ('El panel dice "Detenido" y no arranca: ', 'revisar la pestaña Logs; probar "Reiniciar".'),
            ('Olvidé la contraseña de /gestion: ', 'ver CREDENCIALES.md; se cambia desde el propio panel web.'),
            ('El túnel no activa: ', 'puede haber otra ventana de ngrok abierta usando el mismo túnel; cerrarla primero.'),
        ]
    )

    closing_slide(prs, 'Todo centralizado en un solo lugar', 'Ícono de bandeja → panel → listo')

    out_path = os.path.join(OUT_DIR, 'MANUAL-USO.pptx')
    prs.save(out_path)
    print('Generado:', out_path)


if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    build_instalar()
    build_manual_uso()
