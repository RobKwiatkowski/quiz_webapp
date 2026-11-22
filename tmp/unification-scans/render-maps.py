import html
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path("backend/app/static/maps")
preview = Path("tmp/unification-scans")
land = "#e9dfc7"
water = "#e0edf0"
edge = "#635a50"
choice = "#ddb985"
ink = "#272822"

def render(name, bounds, heading, shapes, labels, dots):
    left, top, width, height = bounds
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{left} {top} {width} {height}">',
           f'  <title>{heading}</title>',
           f'  <rect x="{left}" y="{top}" width="{width}" height="{height}" rx="12" fill="{water}"/>']
    factor = 2
    img = Image.new("RGB", (width * factor, height * factor), water)
    draw = ImageDraw.Draw(img)
    def coords(x,y): return ((x-left)*factor,(y-top)*factor)
    for points, color, spot, label in shapes:
        vertices = [tuple(map(int, pair.split(","))) for pair in points.split()]
        px = [coords(*point) for point in vertices]
        draw.polygon(px, fill=color)
        draw.line(px+[px[0]], fill=edge, width=4, joint="curve")
        attrs = f' class="hotspot-part" data-hotspot-id="{spot}" data-hotspot-label="{label}"' if spot else ""
        svg.append(f'  <polygon{attrs} points="{points}" fill="{color}" stroke="{edge}" stroke-width="2" stroke-linejoin="round"/>')
    for x,y in dots:
        svg.append(f'  <circle cx="{x}" cy="{y}" r="3.5" fill="{ink}" pointer-events="none"/>')
        a,b=coords(x,y)
        draw.ellipse((a-7,b-7,a+7,b+7), fill=ink)
    for x,y,value,size,color in labels:
        svg.append(f'  <text x="{x}" y="{y}" fill="{color}" font-family="sans-serif" font-size="{size}" text-anchor="middle" pointer-events="none">{html.escape(value)}</text>')
        draw.text(coords(x,y),value,font=ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf",size*factor),anchor="ms",fill=color)
    svg.append("</svg>")
    (root / f"{name}.svg").write_text("\n".join(svg)+"\n", encoding="utf-8")
    img.save(preview / f"{name}.png")

render("italy-unification-1860", (58,485,546,575), "Włochy około 1860 roku", [
    ("58,485 604,485 604,707 562,688 523,656 482,625 458,600 421,599 390,624 393,648 369,672 379,704 403,733 412,761 431,801 467,815 479,819 504,816 528,833 568,850 572,869 551,872 535,851 519,855 501,881 494,907 511,938 485,963 475,966 483,931 466,908 449,895 441,872 418,847 386,836 359,829 333,806 304,790 288,770 268,761 252,731 223,711 208,680 189,665 160,689 141,710 111,729 75,720 58,730",land,None,None),
    ("224,772 238,765 244,744 249,760 246,793 239,822 227,837 207,824 205,805 218,795",choice,"corsica","Wyspa na północny zachód od półwyspu"),
    ("190,855 205,859 214,843 233,847 246,860 246,877 234,905 234,934 221,947 208,944 201,957 183,954 179,940 186,916 179,900",choice,"sardinia","Duża wyspa na zachód od półwyspu"),
    ("347,997 364,982 382,986 396,982 420,981 448,973 473,965 464,985 452,1005 449,1033 428,1036 405,1028 386,1012 365,1010",choice,"sicily","Wyspa przy południowym krańcu półwyspu"),
], [(285,515,"WŁOCHY OKOŁO 1860 R.",22,ink),(332,892,"Morze Tyrreńskie",20,"#35657a"),(494,753,"Morze Adriatyckie",18,"#35657a"),(199,674,"Genua",17,ink),(387,819,"Rzym",17,ink),(440,856,"Neapol",17,ink)], [(218,680),(359,817),(420,830)])

render("germany-unification-1871", (682,485,545,521), "Państwa niemieckie w 1871 roku", [
    ("682,485 843,485 847,538 827,587 835,623 816,655 806,693 786,712 775,751 785,783 774,814 793,832 807,865 802,906 822,945 871,959 900,943 923,944 937,960 953,941 988,948 1000,910 1025,889 1011,873 993,845 1012,820 1051,814 1068,825 1097,820 1135,832 1161,807 1196,794 1209,781 1227,777 1227,1006 682,1006",land,None,None),
    ("786,787 806,754 811,721 827,697 819,681 830,657 860,651 882,659 907,668 934,657 967,660 984,642 1000,632 1010,642 1033,629 1045,646 1072,641 1099,624 1118,609 1145,609 1161,594 1197,574 1210,576 1223,603 1227,642 1227,765 1206,778 1195,789 1161,805 1135,832 1097,817 1068,826 1048,810 1021,813 1009,800 989,792 979,778 965,776 936,794 914,793 897,807 877,805 862,816 839,804 829,809 822,829 806,841 796,833",choice,"prussia","Rozległy obszar na północy i wschodzie"),
    ("937,794 965,776 979,778 989,792 1009,800 1018,811 1004,824 992,818 968,825 955,817",choice,"saxony","Obszar między Berlinem a Czechami"),
    ("816,841 832,828 842,835 831,861 829,887 815,921 803,914 807,885 811,865",choice,"baden","Wąski obszar na południowym zachodzie"),
    ("842,835 862,820 876,820 885,830 870,855 874,875 864,902 859,922 841,924 829,917 835,885 831,872",choice,"wurttemberg","Obszar wokół Stuttgartu"),
    ("876,820 897,807 915,798 937,807 955,817 963,835 979,852 995,866 1008,882 1013,892 1001,905 988,910 986,940 970,938 953,944 940,936 925,942 909,933 897,943 880,933 863,927 864,902 874,875 870,855 885,830",choice,"bavaria","Obszar wokół Monachium"),
], [(953,520,"PAŃSTWA NIEMIECKIE W 1871 R.",22,ink),(940,580,"Morze Północne",18,"#35657a"),(1069,573,"Morze Bałtyckie",18,"#35657a"),(1004,745,"Berlin",17,ink),(919,920,"Monachium",17,ink),(846,882,"Stuttgart",13,ink),(738,873,"Francja",18,ink),(1125,925,"Austro-Węgry",18,ink)], [(1004,724),(919,900),(851,864)])
