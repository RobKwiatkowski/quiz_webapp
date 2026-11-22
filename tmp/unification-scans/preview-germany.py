from pathlib import Path

directory = Path(__file__).parent
source = (directory / "garibaldi-leaflet.html").read_text(encoding="utf-8")
source = source.replace("Wyprawa Garibaldiego", "Zjednoczenie Niemiec")
source = source.replace(
    "Kliknij wyspę, na której wylądowali ochotnicy Garibaldiego w 1860 r.",
    "Kliknij stolicę Królestwa Bawarii, które w 1871 r. weszło w skład Cesarstwa Niemieckiego.",
)
source = source.replace("Interaktywna mapa Morza Tyrreńskiego", "Mapa miast Europy Środkowej")
source = source.replace("[[35.8,6.5],[45.2,19.3]]", "[[46.2,7.4],[54,16.5]]")
start = source.index("const normal =")
end = source.index("</script>", start)
script = """const cities = [
  ['Berlin', [52.520, 13.405]],
  ['Drezno', [51.050, 13.738]],
  ['Stuttgart', [48.776, 9.182]],
  ['Monachium', [48.137, 11.575]],
];
for (const [name, coordinates] of cities) {
  const icon = L.divIcon({
    className: 'city-pin',
    html: '<span aria-hidden="true" class="city-dot"></span><span class="city-name">' + name + '</span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  const marker = L.marker(coordinates, {icon, alt: name, title: name}).addTo(map);
  marker.on('click', () => {
    const correct = name === 'Monachium';
    marker.getElement().classList.toggle('right', correct);
    marker.getElement().classList.toggle('wrong', !correct);
    document.getElementById('feedback').textContent = correct
      ? 'Tak. Monachium było stolicą Królestwa Bawarii.'
      : 'Spróbuj jeszcze raz.';
  });
}
"""
source = source[:start] + script + source[end:]
source = source.replace("</style>", """
.city-pin{cursor:pointer}.city-dot{display:block;width:16px;height:16px;margin:4px;border:2px solid #fff;border-radius:50%;box-sizing:border-box;background:#285c73;box-shadow:0 0 0 1px #285c73}
.city-name{position:absolute;left:25px;top:2px;white-space:nowrap;font:bold 14px system-ui;color:#16263b;text-shadow:0 0 4px #fff,0 0 4px #fff}
.city-pin.right .city-dot{background:#248356}.city-pin.wrong .city-dot{background:#b74730}
</style>""")
assert "Królestwa Bawarii" in source and "Garibaldiego" not in source
(directory / "niemcy-leaflet.html").write_text(source, encoding="utf-8")
