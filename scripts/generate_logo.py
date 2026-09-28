import math
from PIL import Image, ImageDraw, ImageFilter

def create_geko_logo(size=512):
    MASTER = 1024
    img = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = MASTER // 2, MASTER // 2

    # 1. Dark Institutional Background Base (Rounded Hexagon / Circle)
    r_outer = 480
    r_inner = 460
    
    # Outer glow
    glow = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer], fill=(16, 185, 129, 60))
    glow = glow.filter(ImageFilter.GaussianBlur(35))
    img.alpha_composite(glow)

    # Dark background plate
    for r in range(r_inner, 0, -2):
        factor = r / r_inner
        red = int(8 + (18 - 8) * factor)
        green = int(11 + (26 - 11) * factor)
        blue = int(15 + (36 - 15) * factor)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(red, green, blue, 255))

    # Metallic Cyan-Emerald Rim Ring
    for w in range(12):
        col = (16, 185, 129, int(200 + 55 * (w / 12)))
        draw.ellipse([cx - (r_inner - w), cy - (r_inner - w), cx + (r_inner - w), cy + (r_inner - w)], outline=col, width=2)

    # Inner decorative grid / radial lines
    grid = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(grid)
    for angle in range(0, 360, 30):
        rad = math.radians(angle)
        x1 = cx + math.cos(rad) * 200
        y1 = cy + math.sin(rad) * 200
        x2 = cx + math.cos(rad) * 440
        y2 = cy + math.sin(rad) * 440
        gdraw.line([(x1, y1), (x2, y2)], fill=(255, 255, 255, 15), width=2)
    img.alpha_composite(grid)

    # 2. Financial Candlesticks (Green & Red) in dynamic chart formation
    # Candlestick definitions: (center_x, top_wick, body_top, body_bottom, bottom_wick, width, is_green)
    candles = [
        (260, 240, 320, 560, 680, 50, False),  # RED Bearish Candle
        (370, 160, 260, 480, 620, 56, True),   # GREEN Bullish Candle
        (480, 190, 310, 600, 710, 50, False),  # RED Bearish Candle
        (590, 120, 200, 450, 580, 62, True),   # GREEN Bullish Candle
        (700, 80,  150, 390, 520, 58, True),   # Leading Big GREEN Candle
    ]

    candle_layer = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(candle_layer)

    for (x, w_top, b_top, b_bot, w_bot, cw, is_g) in candles:
        half_w = cw // 2
        wick_color = (52, 211, 153, 240) if is_g else (248, 113, 113, 240)
        body_color = (16, 185, 129, 235) if is_g else (239, 68, 68, 235)
        border_color = (110, 231, 183, 255) if is_g else (252, 165, 165, 255)

        # Upper & Lower Wicks
        cdraw.line([(x, w_top), (x, b_top)], fill=wick_color, width=6)
        cdraw.line([(x, b_bot), (x, w_bot)], fill=wick_color, width=6)

        # Candle Body
        cdraw.rounded_rectangle([x - half_w, b_top, x + half_w, b_bot], radius=10, fill=body_color, outline=border_color, width=4)

        # Candle Highlight sheen
        cdraw.line([(x - half_w + 5, b_top + 10), (x - half_w + 5, b_bot - 10)], fill=(255, 255, 255, 90), width=4)

    # Glow from candlesticks
    cglow = candle_layer.filter(ImageFilter.GaussianBlur(15))
    img.alpha_composite(cglow)
    img.alpha_composite(candle_layer)

    # 3. Realistic Green Gecko / Lizard wrapping dynamically over the candles
    gecko = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(gecko)

    # S-curve backbone points for Gecko body
    spine = [
        (220, 820), # Tail tip
        (300, 780),
        (380, 710),
        (330, 610),
        (400, 510),
        (470, 420),
        (460, 330),
        (490, 250), # Neck
        (540, 190)  # Head base
    ]

    # Draw tapered tail & body along spine with layered muscular disks
    radii = [12, 22, 40, 62, 85, 95, 90, 72, 60]
    for i in range(len(spine) - 1):
        p1 = spine[i]
        p2 = spine[i+1]
        steps = 40
        for s in range(steps):
            t = s / steps
            x = p1[0] + (p2[0] - p1[0]) * t
            y = p1[1] + (p2[1] - p1[1]) * t
            r = radii[i] + (radii[i+1] - radii[i]) * t

            # Base emerald scale tone
            base_col = (21, 128, 61, 255)
            g_draw.ellipse([x - r, y - r, x + r, y + r], fill=base_col)

            # Highlight dorsal stripe (brighter lime-emerald)
            r_high = r * 0.55
            high_col = (52, 211, 153, 240)
            g_draw.ellipse([x - r_high - r*0.15, y - r_high - r*0.15, x + r_high - r*0.15, y + r_high - r*0.15], fill=high_col)

    # Lizard Legs with Gecko Suction Pads (Toes)
    # Front-Right Leg grasping the high candle
    leg1 = [(490, 310), (590, 290), (660, 280)]
    for p in leg1:
        g_draw.ellipse([p[0]-25, p[1]-25, p[0]+25, p[1]+25], fill=(21, 128, 61, 255))
    g_draw.line(leg1, fill=(34, 197, 94, 255), width=32)
    # Suction pads / toes
    for toe_ang in [-40, -15, 10, 35, 60]:
        tx = 660 + math.cos(math.radians(toe_ang)) * 42
        ty = 280 + math.sin(math.radians(toe_ang)) * 42
        g_draw.line([(660, 280), (tx, ty)], fill=(34, 197, 94, 255), width=10)
        g_draw.ellipse([tx-12, ty-12, tx+12, ty+12], fill=(74, 222, 128, 255), outline=(16, 185, 129, 255), width=3)

    # Front-Left Leg grasping the left candle
    leg2 = [(430, 370), (330, 380), (270, 360)]
    g_draw.line(leg2, fill=(21, 128, 61, 255), width=28)
    for toe_ang in [130, 160, 190, 220, 250]:
        tx = 270 + math.cos(math.radians(toe_ang)) * 38
        ty = 360 + math.sin(math.radians(toe_ang)) * 38
        g_draw.line([(270, 360), (tx, ty)], fill=(34, 197, 94, 255), width=9)
        g_draw.ellipse([tx-10, ty-10, tx+10, ty+10], fill=(74, 222, 128, 255), outline=(16, 185, 129, 255), width=2)

    # Hind Legs
    leg3 = [(440, 560), (550, 590), (620, 560)]
    g_draw.line(leg3, fill=(21, 128, 61, 255), width=30)
    for toe_ang in [-20, 5, 30, 55]:
        tx = 620 + math.cos(math.radians(toe_ang)) * 36
        ty = 560 + math.sin(math.radians(toe_ang)) * 36
        g_draw.line([(620, 560), (tx, ty)], fill=(34, 197, 94, 255), width=9)
        g_draw.ellipse([tx-10, ty-10, tx+10, ty+10], fill=(74, 222, 128, 255))

    # Realistic Gecko Head
    head_poly = [
        (480, 230),  # Right jaw
        (560, 170),  # Snout tip
        (610, 150),  # Nose
        (590, 120),  # Top snout
        (520, 110),  # Forehead
        (460, 140),  # Left crown
        (440, 190)   # Left neck
    ]
    g_draw.polygon(head_poly, fill=(22, 163, 74, 255))
    g_draw.line(head_poly + [head_poly[0]], fill=(74, 222, 128, 255), width=6)

    # Realistic Lizard Eye (Golden Amber Iris with Vertical Slit Pupil & Highlight)
    eye_cx, eye_cy = 530, 145
    g_draw.ellipse([eye_cx - 24, eye_cy - 24, eye_cx + 24, eye_cy + 24], fill=(15, 80, 40, 255))
    g_draw.ellipse([eye_cx - 18, eye_cy - 18, eye_cx + 18, eye_cy + 18], fill=(245, 158, 11, 255), outline=(251, 191, 36, 255), width=3)
    g_draw.ellipse([eye_cx - 4, eye_cy - 14, eye_cx + 4, eye_cy + 14], fill=(10, 10, 10, 255))
    g_draw.ellipse([eye_cx - 8, eye_cy - 10, eye_cx - 3, eye_cy - 5], fill=(255, 255, 255, 240))

    # Reptilian scales texture dots
    dots = [
        (440, 280), (470, 290), (450, 320), (430, 350), (460, 360),
        (420, 420), (450, 430), (400, 480), (430, 490), (370, 540),
        (390, 570), (340, 640), (360, 660), (320, 720), (340, 740)
    ]
    for dx, dy in dots:
        g_draw.ellipse([dx-6, dy-6, dx+6, dy+6], fill=(167, 243, 208, 180))

    # Add lizard shadow & composite
    gecko_shadow = gecko.filter(ImageFilter.GaussianBlur(12))
    img.alpha_composite(gecko_shadow)
    img.alpha_composite(gecko)

    # 4. Neon Cybernetic Accent Ring
    accent = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    adraw = ImageDraw.Draw(accent)
    adraw.arc([cx - 450, cy - 450, cx + 450, cy + 450], start=210, end=350, fill=(52, 211, 153, 255), width=6)
    adraw.arc([cx - 450, cy - 450, cx + 450, cy + 450], start=30, end=170, fill=(239, 68, 68, 255), width=6)
    img.alpha_composite(accent)

    # Supersample down with high quality Lanczos to requested size
    final = img.resize((size, size), Image.Resampling.LANCZOS)
    return final

if __name__ == "__main__":
    import os

    pub_dir = "/home/gekoprotocol/Geko-protocol/public"
    os.makedirs(pub_dir, exist_ok=True)

    print("Generating 512x512 logo...")
    img512 = create_geko_logo(512)
    img512.save(f"{pub_dir}/icon-512.png", "PNG", optimize=True)
    img512.save(f"{pub_dir}/geko-logo.png", "PNG", optimize=True)

    print("Generating 192x192 icon...")
    img192 = create_geko_logo(192)
    img192.save(f"{pub_dir}/icon-192.png", "PNG", optimize=True)

    print("Generating 64x64 favicon.ico...")
    img64 = create_geko_logo(64)
    img64.save(f"{pub_dir}/favicon.ico", format="ICO", sizes=[(64, 64), (32, 32), (16, 16)])

    print("Logo asset generation completed successfully!")
