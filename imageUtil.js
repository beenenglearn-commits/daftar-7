// يضغط صورة مُختارة من الهاتف إلى Data URL صغير (JPEG) قابل للتخزين كحقل داخل
// مستند Firestore مباشرة، فيستفيد تلقائيًا من الحفظ والرفع بلا إنترنت الذي
// توفره مكتبة Firestore (persistentLocalCache في firebase.js) دون أي كود إضافي.
// الهدف: البقاء تحت ~250 كيلوبايت لكل صورة (حد Firestore للمستند 1 ميغابايت، وكل هاتف يقرأ صور كل السجلات، فنُبقيها صغيرة).
const MAX_BYTES = 160 * 1024;
const START_DIM = 1280;
const MIN_DIM = 480;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذّرت قراءة الصورة"));
    img.src = URL.createObjectURL(file);
  });
}

function canvasToDataUrl(canvas, quality) {
  return canvas.toDataURL("image/jpeg", quality);
}

function bytesOfDataUrl(dataUrl) {
  // base64: كل 4 أحرف ≈ 3 بايت
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.ceil((base64.length * 3) / 4);
}

// يرجع { name, type: "image/jpeg", dataUrl } أو يرمي خطأ إن تعذّر ضغط الصورة تحت الحد
export async function compressImage(file) {
  const img = await loadImage(file);
  let dim = START_DIM;
  let dataUrl = "";
  while (dim >= MIN_DIM) {
    const scale = Math.min(1, dim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);

    for (const q of [0.8, 0.6, 0.4]) {
      dataUrl = canvasToDataUrl(canvas, q);
      if (bytesOfDataUrl(dataUrl) <= MAX_BYTES) {
        URL.revokeObjectURL(img.src);
        return { name: file.name, type: "image/jpeg", dataUrl };
      }
    }
    dim = Math.round(dim * 0.75);
  }
  URL.revokeObjectURL(img.src);
  throw new Error("الصورة كبيرة جدًا حتى بعد الضغط — جرّب صورة أخرى");
}

export const isImageFile = (file) => file && file.type && file.type.startsWith("image/");
