// ══════════════════════════════════════════════════════════════════════
//  SUPERINTENDENT VISIT SUMMARY — Firebase Entegrasyonlu Modül
//  Node: /superintendent_data
//  Ay Key Formatı: "YYYY-MM" → görünüm "TEMMUZ 2026"
// ══════════════════════════════════════════════════════════════════════

const SUPT_FB_URL = "https://spark-filo-panel-default-rtdb.europe-west1.firebasedatabase.app/superintendent_data.json";

const SUPT_MONTHS_TR = ["OCAK","ŞUBAT","MART","NİSAN","MAYIS","HAZİRAN","TEMMUZ","AĞUSTOS","EYLÜL","EKİM","KASIM","ARALIK"];

const SUPT_SHIPS = [
  'GIFT','KRONOS','DREAM','FAUN','FLAT','LAKER','JUST','IDON',
  'BEAM','CANAL','DALI','APRIL','COMET','ARES','DODO',
  'ZEYNEP','EMINE','GALATA','ORFA'
];

const SUPT_DEPTS = ['op','tek','hseq'];
const SUPT_DEPT_LABEL = { op:'OPERASYON', tek:'TEKNİK', hseq:'HSEQ' };
const SUPT_DEPT_COLOR = { op:'#2e5fa3', tek:'#1a7a4a', hseq:'#7b3fa0' };
const SUPT_DEPT_BG    = { op:'#dce8f8', tek:'#d5edd9', hseq:'#ecdff4' };
const SUPT_STATUS_OPTS = ['Seyir','Liman','Demir','Tersane'];

// Durum renkleri
const SUPT_STATUS_CLS = {
  'Seyir':   { bg:'#d5edd9', color:'#1a7a4a', border:'#c2e2c8' },
  'Liman':   { bg:'#fef4d1', color:'#b87a11', border:'#fae8a4' },
  'Demir':   { bg:'#dce8f8', color:'#2e5fa3', border:'#c5d7f0' },
  'Tersane': { bg:'#f8d7da', color:'#842029', border:'#f1aeb5' }
};

// Global state
let suptState = {
  ships: { op:[...SUPT_SHIPS], tek:[...SUPT_SHIPS], hseq:[...SUPT_SHIPS] },
  entries: { op:{}, tek:{}, hseq:{} }
};

let suptCurrentTab = 'p-toplam';   // Aktif sekme
let suptModalCtx   = null;          // { dept, ship, monthKey } — modal context
let suptSaving     = false;

// ─── YARDIMCI FONKSİYONLAR ──────────────────────────────────────────

function suptMonthKey(year, monthIdx) {
  // monthIdx: 0-11
  return `${year}-${String(monthIdx + 1).padStart(2,'0')}`;
}

function suptMonthLabel(key) {
  // "2025-08" → "AĞUSTOS 2025"
  if (!key) return '';
  const [y, m] = key.split('-');
  return `${SUPT_MONTHS_TR[parseInt(m,10)-1]} ${y}`;
}

function suptSortedMonthKeys(entries) {
  // entries: { "2025-08": [...], "2026-01": [...] }
  return Object.keys(entries || {}).sort();
}

function suptDaysBetween(start, end) {
  const s = new Date(start), e = new Date(end);
  if (isNaN(s) || isNaN(e)) return 0;
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

function suptFmtDate(isoDate) {
  if (!isoDate) return '';
  const [y,m,d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

function suptToast(msg, dur=2500) {
  let t = document.getElementById('suptToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'suptToast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#0d1b2a;color:#fff;padding:12px 20px;border-radius:6px;font-size:13px;z-index:9999;opacity:0;transform:translateY(10px);transition:all .3s;pointer-events:none;font-family:inherit;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateY(0)';
  clearTimeout(t._to);
  t._to = setTimeout(() => { t.style.opacity='0'; t.style.transform='translateY(10px)'; }, dur);
}

// ─── FIREBASE OKUMA / YAZMA ──────────────────────────────────────────

async function suptLoadFromFirebase() {
  const wrap = document.getElementById('suptLoadingWrap');
  if (wrap) wrap.style.display = 'flex';
  
  try {
    const res = await fetch(SUPT_FB_URL);
    const raw = await res.json();
    
    // KONTROLÜ SIKILAŞTIRDIK: Eğer Firebase'de 'entries' objesi boşsa veriyi zorla yükle!
    let hasData = false;
    if (raw && raw.entries && raw.entries.op) {
        // En azından Operasyon departmanında 1 tane bile gemi kaydı var mı diye bakıyoruz
        if (Object.keys(raw.entries.op).length > 0) {
            hasData = true;
        }
    }

    if (hasData) {
      // 1. Firebase'de dolu veri varsa normal şekilde yükle
      suptState.ships   = raw.ships;
      suptState.entries = raw.entries;
      console.log("Firebase'den ziyaret verileri başarıyla çekildi.");
    } else {
      // 2. FIREBASE BOŞSA VEYA EKSİKSE: HTML'deki gömülü veriyi içeri aktar, dönüştür ve buluta kaydet
      console.log("Firebase boş, geçmiş ziyaret verileri zorla entegre ediliyor...");
      
      // Ekteki HTML dosyasının en altındaki (<div id="persisted-state">) GÜNCEL GEÇMİŞ VERİ
      const oldDataRaw = {"ships":{"op":["GIFT","KRONOS","DREAM","FAUN","FLAT","LAKER","JUST","IDON","BEAM","CANAL","DALI","APRIL","COMET","ARES","DODO","ZEYNEP (NEW)","EMİNE (NEW)","GANI (SOLD)"],"tek":["GIFT","KRONOS","DREAM","FAUN","FLAT","LAKER","JUST","IDON","BEAM","CANAL","DALI","APRIL","COMET","ARES","DODO","ZEYNEP (NEW)","EMİNE (NEW)","GANI (SOLD)"],"hseq":["GIFT","KRONOS","DREAM","FAUN","FLAT","LAKER","JUST","IDON","BEAM","CANAL","DALI","APRIL","COMET","ARES","DODO","ZEYNEP (NEW)","EMİNE (NEW)","GANI (SOLD)"]},"entries":{"op":{"GIFT":{"ARALIK":[{"name":"E.Gür","start":"2025-12-20","end":"2025-12-26","days":7,"status":"Liman"}],"NİSAN":[{"name":"E.Gür","start":"2026-04-28","end":"2026-04-30","days":3,"status":"Tersane"}],"MAYIS":[{"name":"E.Gür","start":"2026-05-01","end":"2026-05-21","days":21,"status":"Tersane"}],"AĞUSTOS":[{"name":"Y.Çağlar","start":"2025-08-06","end":"2025-08-13","days":8,"status":"Seyir"},{"name":"E.Köse","start":"2025-08-12","end":"2025-08-27","days":16,"status":"Tersane"}]},"KRONOS":{"EYLÜL":[{"name":"O.Benzet","start":"2025-09-11","end":"2025-09-29","days":19,"status":"Seyir"}]},"DREAM":{"EYLÜL":[{"name":"O.Karan","start":"2025-09-29","end":"2025-09-30","days":2,"status":"Liman"}],"NİSAN":[{"name":"O.Karan","start":"2026-04-21","end":"2026-04-24","days":4,"status":"Liman"}],"EKİM":[{"name":"O.Karan","start":"2025-10-01","end":"2025-10-01","days":1,"status":"Liman"}]},"FAUN":{"OCAK":[{"name":"O.Karan","start":"2026-01-01","end":"2026-01-19","days":19,"status":"Tersane"}],"ARALIK":[{"name":"O.Karan","start":"2025-12-24","end":"2025-12-31","days":8,"status":"Tersane"}]},"FLAT":{"KASIM":[{"name":"O.Benzet","start":"2025-11-19","end":"2025-11-30","days":12,"status":"Tersane"}],"ARALIK":[{"name":"O.Benzet","start":"2025-12-01","end":"2025-12-19","days":19,"status":"Tersane"}],"ŞUBAT":[{"name":"O.Benzet","start":"2026-02-10","end":"2026-02-25","days":16,"status":"Seyir"}]},"LAKER":{"KASIM":[{"name":"E.Köse","start":"2025-11-11","end":"2025-11-13","days":3}]},"JUST":{"OCAK":[{"name":"E.Köse","start":"2026-02-02","end":"2026-02-11","days":10,"status":"Demir"}],"ŞUBAT":[{"name":"O.Karan","start":"2026-02-26","end":"2026-02-28","days":3,"status":"Seyir"}],"MART":[{"name":"O.Karan","start":"2026-03-01","end":"2026-03-08","days":8,"status":"Liman"},{"name":"E.Köse","start":"2026-03-25","end":"2026-03-26","days":2,"status":"Liman"}],"NİSAN":[{"name":"O.Karan","start":"2026-04-03","end":"2026-04-03","days":1,"status":"Liman"}]},"IDON":{"HAZİRAN":[{"name":"Y.Çağlar","start":"2025-06-23","end":"2025-06-28","days":6}],"OCAK":[{"name":"E.Gür","start":"2026-01-24","end":"2026-01-31","days":8,"status":"Seyir"}],"ŞUBAT":[{"name":"E.Gür","start":"2026-02-01","end":"2026-02-13","days":13,"status":"Seyir"}]},"BEAM":{"HAZİRAN":[{"name":"O.Benzet","start":"2025-06-15","end":"2025-06-23","days":9,"status":"Seyir"}]},"CANAL":{},"DALI":{"OCAK":[{"name":"O.Benzet","start":"2026-01-20","end":"2026-01-23","days":4,"status":"Demir"}],"MART":[{"name":"E.Gür","start":"2026-03-19","end":"2026-03-23","days":5,"status":"Liman"}]},"APRIL":{"HAZİRAN":[{"name":"O.Benzet","start":"2025-06-12","end":"2025-06-15","days":4,"status":"Seyir"}],"KASIM":[{"name":"O.Benzet","start":"2025-11-05","end":"2025-11-11","days":7,"status":"Seyir"}],"ARALIK":[{"name":"O.Benzet","start":"2025-12-24","end":"2025-12-31","days":8,"status":"Demir"}],"OCAK":[{"name":"O.Benzet","start":"2026-01-01","end":"2026-01-16","days":16,"status":"Demir"}],"MART":[{"name":"O.Benzet","start":"2026-03-09","end":"2026-03-28","days":20,"status":"Tersane"}],"NİSAN":[{"name":"O.Benzet","start":"2026-04-01","end":"2026-04-28","days":28,"status":"Tersane"}]},"COMET":{"OCAK":[{"name":"O.Karan","start":"2026-01-19","end":"2026-01-28","days":10,"status":"Tersane"}]},"ARES":{},"DODO":{},"ZEYNEP (NEW)":{"KASIM":[{"name":"E.Köse","start":"2025-11-09","end":"2025-11-20","days":12,"status":"Tersane"}]},"EMİNE (NEW)":{"NİSAN":[{"name":"E.Köse","start":"2026-04-01","end":"2026-04-15","days":15,"status":"Tersane"}],"MART":[{"name":"E.Köse","start":"2026-03-31","end":"2026-03-31","days":1,"status":"Tersane"}]},"GANI (SOLD)":{"AĞUSTOS":[]}},"tek":{"GIFT":{"AĞUSTOS":[{"name":"M.O.Kırmızı","start":"2025-08-12","end":"2025-08-27","days":16,"status":"Tersane"},{"name":"K.Gümüş","start":"2025-08-14","end":"2025-08-31","days":18,"status":"Tersane"}],"EYLÜL":[{"name":"M.O.Kırmızı","start":"2025-09-23","end":"2025-09-30","days":8,"status":"Tersane"},{"name":"K.Gümüş","start":"2025-09-01","end":"2025-09-30","days":30,"status":"Tersane"}],"EKİM":[{"name":"M.O.Kırmızı","start":"2025-10-01","end":"2025-10-01","days":1,"status":"Tersane"},{"name":"K.Gümüş","start":"2025-10-01","end":"2025-10-03","days":3,"status":"Tersane"}],"ARALIK":[{"name":"K.Gümüş","start":"2025-12-20","end":"2025-12-26","days":7,"status":"Liman"}],"MAYIS":[{"name":"Ö.B.Yıldırım","start":"2026-05-01","end":"2026-05-22","days":22}],"NİSAN":[{"name":"Ö.B.Yıldırım","start":"2026-04-28","end":"2026-04-30","days":3}]},"KRONOS":{},"DREAM":{"NİSAN":[{"name":"C.Yayla","start":"2026-04-20","end":"2026-04-25","days":6,"status":"Liman"},{"name":"D.İlimsever","start":"2026-04-20","end":"2026-04-25","days":6,"status":"Liman"}]},"FAUN":{"ARALIK":[{"name":"D.İlimsever","start":"2025-12-24","end":"2025-12-31","days":8,"status":"Tersane"},{"name":"Ö.B.Yıldırım","start":"2025-12-29","end":"2025-12-31","days":3,"status":"Tersane"}],"OCAK":[{"name":"D.İlimsever","start":"2026-01-01","end":"2026-01-21","days":21,"status":"Tersane"},{"name":"Ö.B.Yıldırım","start":"2026-01-01","end":"2026-01-31","days":31,"status":"Tersane"}],"MART":[{"name":"D.İlimsever","start":"2026-03-17","end":"2026-03-28","days":12,"status":"Seyir"}]},"FLAT":{"KASIM":[{"name":"K.Gümüş","start":"2025-11-19","end":"2025-11-30","days":12,"status":"Tersane"}],"ARALIK":[{"name":"K.Gümüş","start":"2025-12-01","end":"2025-12-19","days":19,"status":"Tersane"}],"ŞUBAT":[{"name":"K.Gümüş","start":"2026-02-13","end":"2026-02-25","days":13,"status":"Seyir"}]},"LAKER":{"TEMMUZ":[{"name":"C.Yayla","start":"2025-07-21","end":"2025-07-26","days":6,"status":"Liman"}],"KASIM":[{"name":"C.Yayla","start":"2025-11-28","end":"2025-11-30","days":3,"status":"Liman"},{"name":"Ö.B.Yıldırım","start":"2025-11-20","end":"2025-11-30","days":11,"status":"Tersane"}],"ARALIK":[{"name":"C.Yayla","start":"2025-12-01","end":"2025-12-03","days":3,"status":"Liman"},{"name":"Ö.B.Yıldırım","start":"2025-12-01","end":"2025-12-24","days":24,"status":"Tersane"}]},"JUST":{"EYLÜL":[{"name":"D.İlimsever","start":"2025-09-17","end":"2025-09-30","days":14,"status":"Liman"},{"name":"C.Yayla","start":"2025-09-17","end":"2025-09-30","days":14,"status":"Seyir"}],"MART":[{"name":"C.Yayla","start":"2026-03-25","end":"2026-03-27","days":3,"status":"Liman"},{"name":"Ö.B.Yıldırım","start":"2026-03-25","end":"2026-03-26","days":2,"status":"Liman"}],"NİSAN":[{"name":"Ö.B.Yıldırım","start":"2026-04-02","end":"2026-04-02","days":1}]},"IDON":{"HAZİRAN":[{"name":"C.Yayla","start":"2025-06-17","end":"2025-06-21","days":5,"status":"Liman"},{"name":"K.Gümüş","start":"2025-06-17","end":"2025-06-23","days":7,"status":"Liman"}],"ŞUBAT":[{"name":"D.İlimsever","start":"2026-01-22","end":"2026-02-13","days":23,"status":"Seyir"}]},"BEAM":{"HAZİRAN":[{"name":"Ö.B.Yıldırım","start":"2025-06-17","end":"2025-06-23","days":7,"status":"Seyir"}]},"CANAL":{},"DALI":{"OCAK":[{"name":"K.Gümüş","start":"2026-01-20","end":"2026-01-23","days":4,"status":"Seyir"}],"MART":[{"name":"K.Gümüş","start":"2026-03-19","end":"2026-03-23","days":5,"status":"Seyir"},{"name":"C.Yayla","start":"2026-03-19","end":"2026-03-23","days":5,"status":"Seyir"}]},"APRIL":{"KASIM":[{"name":"C.Yayla","start":"2025-11-05","end":"2025-11-10","days":6,"status":"Liman"}],"MART":[{"name":"M.O.Kırmızı","start":"2026-03-09","end":"2026-03-31","days":23,"status":"Tersane"}],"NİSAN":[{"name":"M.O.Kırmızı","start":"2026-04-01","end":"2026-04-30","days":30,"status":"Tersane"}],"MAYIS":[{"name":"K.Gümüş","start":"2026-05-16","end":"2026-05-26","days":11,"status":"Liman"}]},"COMET":{"OCAK":[{"name":"Ö.B.Yıldırım","start":"2026-01-01","end":"2026-01-31","days":31,"status":"Tersane"}],"NİSAN":[{"name":"Ö.B.Yıldırım","start":"2026-04-22","end":"2026-04-22","days":1,"status":"Tersane"}],"MART":[{"name":"Ö.B.Yıldırım","start":"2026-03-01","end":"2026-03-02","days":2,"status":"Tersane"}],"ŞUBAT":[{"name":"Ö.B.Yıldırım","start":"2026-02-01","end":"2026-02-28","days":28,"status":"Tersane"}]},"ARES":{"MART":[{"name":"D.İlimsever","start":"2026-03-01","end":"2026-03-11","days":11,"status":"Liman"}]},"DODO":{"TEMMUZ":[{"name":"M.O.Kırmızı","start":"2025-07-26","end":"2025-07-30","days":5,"status":"Liman"}],"AĞUSTOS":[{"name":"M.O.Kırmızı","start":"2025-08-01","end":"2025-08-02","days":2,"status":"Liman"}],"NİSAN":[{"name":"K.Gümüş","start":"2026-04-26","end":"2026-04-30","days":5,"status":"Seyir"}],"MAYIS":[{"name":"K.Gümüş","start":"2026-05-01","end":"2026-05-01","days":1,"status":"Seyir"}]},"ZEYNEP (NEW)":{"KASIM":[{"name":"M.O.Kırmızı","start":"2025-11-09","end":"2025-11-20","days":12,"status":"Tersane"}]},"EMİNE (NEW)":{"NİSAN":[{"name":"M.O.Kırmızı","start":"2026-04-05","end":"2026-04-15","days":11,"status":"Tersane"}]},"GANI (SOLD)":{}},"hseq":{"GIFT":{"HAZİRAN":[{"name":"M.B.Aktaş","start":"2025-06-02","end":"2025-06-05","days":4,"status":"Liman"},{"name":"M.A.Yener","start":"2025-06-02","end":"2025-06-05","days":4,"status":"Liman"}],"ŞUBAT":[{"name":"M.A.Yener","start":"2026-02-10","end":"2026-02-13","days":4,"status":"Demir"},{"name":"M.B.Aktaş","start":"2026-02-10","end":"2026-02-13","days":4,"status":"Demir"}]},"KRONOS":{"TEMMUZ":[{"name":"M.A.Yener","start":"2025-07-04","end":"2025-07-09","days":6,"status":"Liman"}]},"DREAM":{"AĞUSTOS":[{"name":"M.B.Aktaş","start":"2025-08-24","end":"2025-08-31","days":8,"status":"Liman"},{"name":"M.A.Yener","start":"2025-08-24","end":"2025-08-31","days":8,"status":"Liman"}],"ARALIK":[],"KASIM":[]},"FAUN":{},"FLAT":{"OCAK":[{"name":"M.B.Aktaş","start":"2026-01-07","end":"2026-01-10","days":4,"status":"Tersane"}]},"LAKER":{"TEMMUZ":[{"name":"M.A.Yener","start":"2025-07-21","end":"2025-07-25","days":5,"status":"Liman"},{"name":"M.B.Aktaş","start":"2025-07-21","end":"2025-07-25","days":5,"status":"Liman"}],"KASIM":[{"name":"S.İntepe","start":"2025-11-23","end":"2025-11-30","days":8}]},"JUST":{"EYLÜL":[{"name":"M.B.Aktaş","start":"2025-09-17","end":"2025-09-20","days":4,"status":"Liman"}]},"IDON":{},"BEAM":{},"CANAL":{"KASIM":[{"name":"M.A.Yener","start":"2025-11-19","end":"2025-11-30","days":12,"status":"Seyir"}],"ARALIK":[{"name":"M.A.Yener","start":"2025-12-01","end":"2025-12-12","days":12,"status":"Seyir"}]},"DALI":{},"APRIL":{"NİSAN":[{"name":"M.B.Aktaş","start":"2026-04-16","end":"2026-04-25","days":10,"status":"Tersane"},{"name":"S.İntepe","start":"2026-04-27","end":"2026-04-29","days":3}]},"COMET":{},"ARES":{},"DODO":{},"ZEYNEP (NEW)":{"OCAK":[{"name":"M.B.Aktaş","start":"2026-01-02","end":"2026-01-06","days":5,"status":"Tersane"}]},"EMİNE (NEW)":{"NİSAN":[{"name":"M.B.Aktaş","start":"2026-04-16","end":"2026-04-25","days":10,"status":"Tersane"}]},"GANI (SOLD)":{}}}};

      // Eski Türkçe ayları yeni YYYY-MM formatına çeviren dönüştürücü harita
      const monthMap = {
        "HAZİRAN": "2025-06", "TEMMUZ": "2025-07", "AĞUSTOS": "2025-08",
        "EYLÜL": "2025-09", "EKİM": "2025-10", "KASIM": "2025-11",
        "ARALIK": "2025-12", "OCAK": "2026-01", "ŞUBAT": "2026-02",
        "MART": "2026-03", "NİSAN": "2026-04", "MAYIS": "2026-05"
      };

      let newEntries = { op: {}, tek: {}, hseq: {} };

      ['op', 'tek', 'hseq'].forEach(dept => {
          Object.keys(oldDataRaw.entries[dept] || {}).forEach(ship => {
              newEntries[dept][ship] = {};
              Object.keys(oldDataRaw.entries[dept][ship]).forEach(oldMonth => {
                  let newMonthKey = monthMap[oldMonth] || oldMonth;
                  newEntries[dept][ship][newMonthKey] = oldDataRaw.entries[dept][ship][oldMonth];
              });
          });
      });

      // Sistemi güncelle ve Firebase'e YAZ!
      suptState.ships = oldDataRaw.ships;
      suptState.entries = newEntries;
      
      await suptSaveToFirebase();
    }
  } catch(e) {
    console.error('Superintendent Firebase yükleme hatası:', e);
    suptToast('⚠️ Veriler yüklenemedi, internet bağlantısını kontrol edin.', 4000);
  } finally {
    if (wrap) wrap.style.display = 'none';
    suptRenderCurrentTab();
  }
}

async function suptSaveToFirebase() {
  if (suptSaving) return;
  suptSaving = true;
  try {
    await fetch(SUPT_FB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(suptState)
    });
    console.log('Superintendent verisi Firebase\'e kaydedildi.');
  } catch(e) {
    console.error('Superintendent kaydetme hatası:', e);
    suptToast('⚠️ Kaydetme başarısız!', 3500);
  } finally {
    suptSaving = false;
  }
}

// ─── SEKME YÖNETİMİ ─────────────────────────────────────────────────

// ─── SEKME YÖNETİMİ VE GLASSMORPHISM ─────────────────────────────────────────

function suptTabSwitch(panelId) {
  suptCurrentTab = panelId;
  
  // Butonların aktiflik durumunu ve renklerini ayarla
  document.querySelectorAll('#superintendentPanel .supt-tab').forEach(t => {
    const isActive = t.dataset.panel === panelId;
    t.classList.toggle('active', isActive);
    
    // Inline stilleri zorla eziyoruz
    if (isActive) {
       t.style.background = 'rgba(0, 216, 200, 0.15)';
       t.style.color = 'var(--teal)';
    } else {
       t.style.background = 'transparent';
       t.style.color = 'var(--muted)';
    }
  });
  
  // PANELLERİN GÖRÜNÜRLÜĞÜNÜ ZORLA DEĞİŞTİR (Hatanın Çözümü)
  document.querySelectorAll('#superintendentPanel .supt-panel').forEach(p => {
    if (p.id === panelId) {
      p.style.display = 'block';
      p.classList.add('active');
    } else {
      p.style.display = 'none';
      p.classList.remove('active');
    }
  });
  
  suptRenderCurrentTab();
}

function suptRenderCurrentTab() {
  switch(suptCurrentTab) {
    case 'p-toplam':  suptRenderToplam();  break;
    case 'p-calisan': suptRenderCalisan(); break;
    case 'p-bulk':    suptRenderBulk();    break;
    case 'p-op':      suptRenderDept('op');   break;
    case 'p-tek':     suptRenderDept('tek');  break;
    case 'p-hseq':    suptRenderDept('hseq'); break;
  }
  
  // TÜM TABLOLARA MAT GLASSMORPHISM UYGULA
  setTimeout(() => {
      document.querySelectorAll('#superintendentPanel table').forEach(tbl => {
          let wrapper = tbl.parentElement;
          if(wrapper) {
              wrapper.style.background = 'rgba(14, 32, 36, 0.75)'; // Mat Cam Efekti
              wrapper.style.backdropFilter = 'blur(16px)';
              wrapper.style.WebkitBackdropFilter = 'blur(16px)';
              wrapper.style.border = '1px solid rgba(0, 216, 200, 0.15)';
              wrapper.style.borderRadius = '12px';
              wrapper.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
          }
          // Tablo başlık satırını uyumlu şeffaf siyah yap
          let theadTr = tbl.querySelector('thead tr');
          if (theadTr) {
              theadTr.style.background = 'rgba(0, 0, 0, 0.4)';
              theadTr.style.color = 'var(--muted)';
          }
      });
  }, 50);
}

// ─── GENEL ÖZET ─────────────────────────────────────────────────────

function suptRenderToplam() {
  const allEntries = suptGetAllEntries();
  const totalVisits = allEntries.length;
  const totalDays   = allEntries.reduce((s, e) => s + (e.days || 0), 0);
  const uniqueNames = new Set(allEntries.map(e => e.name)).size;

  document.getElementById('suptCardVisits').textContent = totalVisits;
  document.getElementById('suptCardDays').textContent   = totalDays;
  document.getElementById('suptCardPeople').textContent = uniqueNames;

  const byMonth = {};
  allEntries.forEach(e => {
    if (!byMonth[e.monthKey]) byMonth[e.monthKey] = [];
    byMonth[e.monthKey].push(e);
  });

  const sortedKeys = Object.keys(byMonth).sort().reverse();
  let html = '';
  sortedKeys.forEach(mk => {
    // Ayırıcı Başlık (Temaya uygun Teal renginde)
    html += `<tr><td colspan="7" style="background:rgba(0, 216, 200, 0.1);color:var(--teal);border-bottom:1px solid rgba(0,216,200,0.2);font-weight:700;font-size:12px;letter-spacing:1px;padding:8px 12px;">▼ ${suptMonthLabel(mk)}</td></tr>`;
    byMonth[mk].forEach(e => {
      const dCls = SUPT_DEPT_COLOR[e.dept] || '#888';
      const dLabel = SUPT_DEPT_LABEL[e.dept] || e.dept;
      html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.04); color:var(--text);">
        <td style="padding:8px 12px;">${suptMonthLabel(mk)}</td>
        <td style="padding:8px 12px;">${e.name}</td>
        <td style="padding:8px 12px;font-weight:700;color:var(--teal);">${e.ship}</td>
        <td style="padding:8px 12px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dCls};margin-right:5px;box-shadow:0 0 5px ${dCls};"></span>${dLabel}
        </td>
        <td style="padding:8px 12px;font-weight:700;color:var(--warn);">${e.days}</td>
        <td style="padding:8px 12px;font-family:'DM Mono'; font-size:11px;">${suptFmtDate(e.start)}</td>
        <td style="padding:8px 12px;font-family:'DM Mono'; font-size:11px;">${suptFmtDate(e.end)}</td>
      </tr>`;
    });
  });
  document.getElementById('suptToplamBody').innerHTML = html || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--muted);">Henüz kayıt yok.</td></tr>';
}

// ─── ÇALIŞAN BAZLI ──────────────────────────────────────────────────

function suptRenderCalisan() {
  const allEntries = suptGetAllEntries();
  const byPerson = {};
  allEntries.forEach(e => {
    if (!byPerson[e.name]) byPerson[e.name] = { visits:0, days:0, ships:new Set(), depts:new Set() };
    byPerson[e.name].visits++;
    byPerson[e.name].days += (e.days || 0);
    byPerson[e.name].ships.add(e.ship);
    byPerson[e.name].depts.add(e.dept);
  });

  const sorted = Object.entries(byPerson).sort((a,b) => b[1].days - a[1].days);
  let html = '';
  sorted.forEach(([name, d]) => {
    const deptBadges = [...d.depts].map(dep => `<span style="background:rgba(255,255,255,0.05);color:${SUPT_DEPT_COLOR[dep]};border:1px solid ${SUPT_DEPT_COLOR[dep]};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;margin-right:3px;">${SUPT_DEPT_LABEL[dep]}</span>`).join('');
    html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.04); color:var(--text);">
      <td style="padding:9px 12px;font-weight:700;">${name}</td>
      <td style="padding:9px 12px;">${deptBadges}</td>
      <td style="padding:9px 12px;font-weight:900;color:var(--ok);">${d.days}</td>
      <td style="padding:9px 12px;">${d.visits}</td>
      <td style="padding:9px 12px;color:var(--muted);">${[...d.ships].join(', ')}</td>
    </tr>`;
  });
  document.getElementById('suptCalisanBody').innerHTML = html || '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--muted);">Henüz kayıt yok.</td></tr>';
}

// ─── ZİYARET TABLOSU (BULK OVERVIEW) ────────────────────────────────

function suptRenderBulk() {
  const allEntries = suptGetAllEntries();
  const allMonths = [...new Set(allEntries.map(e => e.monthKey))].sort();
  const allShips  = suptGetAllShips();

  let thHtml = '<th style="text-align:left;padding:10px;background:rgba(0,0,0,0.5);color:var(--muted);position:sticky;left:0;min-width:130px;border-bottom:1px solid rgba(0,216,200,0.2);">GEMİ</th>';
  allMonths.forEach(mk => {
    thHtml += `<th style="padding:10px;background:rgba(0,0,0,0.5);color:var(--muted);text-align:center;white-space:nowrap;border-bottom:1px solid rgba(0,216,200,0.2);">${suptMonthLabel(mk)}</th>`;
  });

  let tbodyHtml = '';
  allShips.forEach(ship => {
    let row = `<td style="padding:7px 10px;font-weight:700;background:rgba(14,32,36,0.9);color:var(--text);position:sticky;left:0;border-right:1px solid rgba(0,216,200,0.15);border-bottom:1px solid rgba(0,216,200,0.05);">${ship}</td>`;
    allMonths.forEach(mk => {
      let chips = '';
      SUPT_DEPTS.forEach(dept => {
        const entries = (suptState.entries[dept]?.[ship]?.[mk] || []);
        entries.forEach(e => {
          const col = SUPT_DEPT_COLOR[dept];
          chips += `<span style="display:inline-block;background:rgba(255,255,255,0.05);color:${col};border:1px solid ${col};padding:2px 5px;border-radius:4px;font-size:10px;font-weight:700;margin:2px;">${e.name.split('.')[0]}.${e.name.split('.')[1]||''} (${e.days}g)</span>`;
        });
      });
      row += `<td style="padding:6px 8px;text-align:center;border-bottom:1px solid rgba(0,216,200,0.05);vertical-align:middle;">${chips || '<span style="color:rgba(255,255,255,0.1);font-size:11px;">—</span>'}</td>`;
    });
    tbodyHtml += `<tr style="transition:background 0.2s;" onmouseover="this.style.background='rgba(0,216,200,0.05)'" onmouseout="this.style.background='transparent'">${row}</tr>`;
  });

  document.getElementById('suptBulkTable').innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr>${thHtml}</tr></thead>
      <tbody>${tbodyHtml}</tbody>
    </table>`;
}

// ─── DEPARTMAN GİRİŞ TABLOSU ────────────────────────────────────────

function suptRenderDept(dept) {
  const ships = suptState.ships[dept] || [...SUPT_SHIPS];
  const allEntries = suptGetAllEntries();
  const allMonthKeys = suptGetExtendedMonthKeys(allEntries);

  let thHtml = `<th style="background:rgba(0,0,0,0.5);color:var(--muted);padding:9px 12px;text-align:left;position:sticky;left:0;min-width:130px;border-bottom:1px solid rgba(0,216,200,0.2);">GEMİ</th>`;
  allMonthKeys.forEach(mk => {
    const isPresent = mk === new Date().toISOString().slice(0,7);
    thHtml += `<th style="background:rgba(0,0,0,0.5);color:${isPresent?'var(--gold)':'var(--muted)'};padding:9px 8px;text-align:center;min-width:160px;white-space:nowrap;border-bottom:1px solid rgba(0,216,200,0.2);${isPresent?'border-bottom:2px solid var(--gold);':''}">${suptMonthLabel(mk)}</th>`;
  });

  let tbodyHtml = '';
  ships.forEach(ship => {
    let row = `<td style="padding:8px 12px;font-weight:700;font-size:13px;background:rgba(14,32,36,0.95);color:var(--text);position:sticky;left:0;z-index:1;border-right:1px solid rgba(0,216,200,0.15);border-bottom:1px solid rgba(0,216,200,0.05);">${ship}</td>`;
    allMonthKeys.forEach(mk => {
      const entries = suptState.entries[dept]?.[ship]?.[mk] || [];
      let cellInner = '';
      entries.forEach((e, idx) => {
        const stStyle = SUPT_STATUS_CLS[e.status] || {};
        const stHtml = e.status ? `<span style="display:inline-block;background:rgba(255,255,255,0.05);color:${stStyle.color||'#ccc'};border:1px solid ${stStyle.border||'#ccc'};border-radius:4px;font-size:10px;padding:2px 6px;font-weight:700;margin-top:6px;">${e.status}</span>` : '';
        cellInner += `
          <div style="background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 10px;margin-bottom:6px;position:relative;text-align:left;">
            <div style="font-weight:700;color:var(--text);font-size:13px;">${e.name}</div>
            <div style="color:var(--muted);font-family:'DM Mono';font-size:11px;margin-bottom:2px;margin-top:4px;">${suptFmtDate(e.start)} → ${suptFmtDate(e.end)}</div>
            ${stHtml}
            <span style="background:var(--teal);color:#000;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:800;position:absolute;top:6px;right:6px;">${e.days}g</span>
            <span onclick="suptDeleteEntry('${dept}','${ship}','${mk}',${idx})" style="position:absolute;bottom:6px;right:6px;font-size:12px;color:var(--bad);cursor:pointer;" title="Sil">✕</span>
          </div>`;
      });
      const isFuture = mk >= new Date().toISOString().slice(0,7);
      const cellBg = isFuture && mk > new Date().toISOString().slice(0,7) ? 'rgba(0,0,0,0.2)' : (entries.length ? 'rgba(0,216,200,0.03)' : 'transparent');
      
      row += `<td onclick="suptOpenModal('${dept}','${ship}','${mk}')" style="min-height:56px;padding:6px;cursor:pointer;vertical-align:top;border-bottom:1px solid rgba(0,216,200,0.05);border-right:1px solid rgba(0,216,200,0.05);background:${cellBg};transition:background .2s;" onmouseover="this.style.background='rgba(0,216,200,0.1)'" onmouseout="this.style.background='${cellBg}'">
        ${cellInner}
        <div style="display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.15);font-size:22px;height:24px;margin-top:4px;transition:color 0.2s;" onmouseover="this.style.color='var(--teal)'" onmouseout="this.style.color='rgba(255,255,255,0.15)'">+</div>
      </td>`;
    });
    tbodyHtml += `<tr>${row}</tr>`;
  });

  const containerId = `suptDeptTable_${dept}`;
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div style="overflow:auto;border-radius:6px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr>${thHtml}</tr></thead>
          <tbody>${tbodyHtml}</tbody>
        </table>
      </div>`;
  }
}

  // Satırlar
  let tbodyHtml = '';
  ships.forEach(ship => {
    let row = `<td style="padding:8px 12px;font-weight:700;font-size:13px;background:#f0f4f8;position:sticky;left:0;z-index:1;border-right:2px solid #c8d8ea;">${ship}</td>`;
    allMonthKeys.forEach(mk => {
      const entries = suptState.entries[dept]?.[ship]?.[mk] || [];
      let cellInner = '';
      entries.forEach((e, idx) => {
        const stStyle = SUPT_STATUS_CLS[e.status] || {};
        const stHtml = e.status ? `<span style="display:inline-block;background:${stStyle.bg||'#eee'};color:${stStyle.color||'#333'};border:1px solid ${stStyle.border||'#ccc'};border-radius:4px;font-size:10px;padding:2px 6px;font-weight:700;margin-top:4px;">${e.status}</span>` : '';
        cellInner += `
          <div style="background:#fff;border:1px solid #c8d8ea;border-radius:5px;padding:5px 8px;margin-bottom:4px;position:relative;">
            <div style="font-weight:700;color:#1a2e45;font-size:13px;">${e.name}</div>
            <div style="color:#6b8aaa;font-size:11px;">${suptFmtDate(e.start)} → ${suptFmtDate(e.end)}</div>
            ${stHtml}
            <span style="background:#e8a020;color:#0d1b2a;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:700;position:absolute;top:5px;right:5px;">${e.days}g</span>
            <span onclick="suptDeleteEntry('${dept}','${ship}','${mk}',${idx})" style="position:absolute;bottom:4px;right:5px;font-size:12px;color:#bbb;cursor:pointer;" title="Sil">✕</span>
          </div>`;
      });
      const isFuture = mk >= new Date().toISOString().slice(0,7);
      const cellBg = isFuture && mk > new Date().toISOString().slice(0,7) ? 'rgba(232,160,32,0.04)' : (entries.length ? '#f8fdff' : '');
      row += `<td onclick="suptOpenModal('${dept}','${ship}','${mk}')" style="min-height:56px;padding:5px;cursor:pointer;vertical-align:top;border-bottom:1px solid #e8f0f8;border-right:1px solid #e8f0f8;background:${cellBg};transition:background .1s;" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='${cellBg}'">
        ${cellInner}
        <div style="display:flex;align-items:center;justify-content:center;color:#ccc;font-size:18px;height:24px;margin-top:2px;">+</div>
      </td>`;
    });
    tbodyHtml += `<tr>${row}</tr>`;
  });

  const containerId = `suptDeptTable_${dept}`;
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div style="overflow:auto;background:#fff;border-radius:6px;box-shadow:0 2px 8px rgba(13,27,42,.12);">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr>${thHtml}</tr></thead>
          <tbody>${tbodyHtml}</tbody>
        </table>
      </div>`;
  }
}

// ─── AY KEY LİSTESİ (Sonsuz Takvim) ────────────────────────────────

function suptGetExtendedMonthKeys(allEntries) {
  const existing = new Set(allEntries.map(e => e.monthKey));
  // En eski kayıt veya 2025-08 başlangıç
  let minKey = '2025-08';
  existing.forEach(k => { if (k < minKey) minKey = k; });

  // 3 ay sonrasına kadar uzat
  const now = new Date();
  const futureEnd = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const futureKey = `${futureEnd.getFullYear()}-${String(futureEnd.getMonth()+1).padStart(2,'0')}`;

  const maxKey = futureKey > minKey ? futureKey : minKey;

  const keys = [];
  let [y, m] = minKey.split('-').map(Number);
  const [ey, em] = maxKey.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2,'0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return keys;
}

// ─── ENTRY YARDIMCILARI ──────────────────────────────────────────────

function suptGetAllEntries() {
  const result = [];
  SUPT_DEPTS.forEach(dept => {
    const deptEntries = suptState.entries[dept] || {};
    Object.entries(deptEntries).forEach(([ship, monthMap]) => {
      Object.entries(monthMap).forEach(([mk, arr]) => {
        (arr || []).forEach(e => {
          result.push({ ...e, dept, ship, monthKey: mk });
        });
      });
    });
  });
  return result;
}

function suptGetAllShips() {
  const s = new Set([...SUPT_SHIPS]);
  SUPT_DEPTS.forEach(dept => {
    (suptState.ships[dept] || []).forEach(sh => s.add(sh));
  });
  return [...s];
}

// ─── MODAL: GİRİŞ EKLE ───────────────────────────────────────────────

function suptOpenModal(dept, ship, monthKey) {
  suptModalCtx = { dept, ship, monthKey };
  document.getElementById('suptModalTitle').textContent = `${ship} — ${suptMonthLabel(monthKey)}`;
  document.getElementById('suptModalDeptBadge').textContent = SUPT_DEPT_LABEL[dept];
  document.getElementById('suptModalDeptBadge').style.cssText = `padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${SUPT_DEPT_BG[dept]};color:${SUPT_DEPT_COLOR[dept]}`;

  // Formu temizle
  document.getElementById('suptInpName').value = '';
  document.getElementById('suptInpStart').value = '';
  document.getElementById('suptInpEnd').value = '';
  document.getElementById('suptInpStatus').value = '';
  document.getElementById('suptDaysPreview').textContent = '';

  // Mevcut kayıtları çiz
  suptRenderModalList();

  document.getElementById('suptModalOverlay').style.display = 'flex';
}

function suptCloseModal() {
  document.getElementById('suptModalOverlay').style.display = 'none';
  suptModalCtx = null;
}

function suptRenderModalList() {
  if (!suptModalCtx) return;
  const { dept, ship, monthKey } = suptModalCtx;
  const entries = suptState.entries[dept]?.[ship]?.[monthKey] || [];
  let html = '';
  entries.forEach((e, idx) => {
    html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#f7f9fc;border-radius:4px;margin-bottom:6px;font-size:12px;">
      <div>
        <span style="font-weight:600;color:#1a2e45;">${e.name}</span>
        <span style="color:#6b8aaa;font-size:11px;margin-left:8px;">${suptFmtDate(e.start)} → ${suptFmtDate(e.end)}</span>
        ${e.status ? `<span style="margin-left:6px;font-size:11px;font-weight:700;color:${(SUPT_STATUS_CLS[e.status]||{}).color||'#333'};">${e.status}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="background:#e8a020;color:#0d1b2a;border-radius:3px;padding:2px 7px;font-size:11px;font-weight:700;">${e.days}g</span>
        <span onclick="suptDeleteEntry('${dept}','${ship}','${monthKey}',${idx});suptRenderModalList();" style="cursor:pointer;color:#bbb;font-size:14px;padding:0 4px;" title="Sil">✕</span>
      </div>
    </div>`;
  });
  document.getElementById('suptModalList').innerHTML = html || '<div style="color:#6b8aaa;font-size:12px;padding:8px 0;">Henüz kayıt yok.</div>';
}

function suptUpdateDaysPreview() {
  const s = document.getElementById('suptInpStart').value;
  const e = document.getElementById('suptInpEnd').value;
  if (s && e) {
    const d = suptDaysBetween(s, e);
    document.getElementById('suptDaysPreview').textContent = d > 0 ? `${d} gün` : '';
  }
}

function suptSaveEntry() {
  if (!suptModalCtx) return;
  const { dept, ship, monthKey } = suptModalCtx;

  const name   = document.getElementById('suptInpName').value.trim();
  const start  = document.getElementById('suptInpStart').value;
  const end    = document.getElementById('suptInpEnd').value;
  const status = document.getElementById('suptInpStatus').value;

  if (!name || !start || !end) { suptToast('⚠️ Ad, gidiş ve dönüş tarihi zorunlu!'); return; }
  if (end < start) { suptToast('⚠️ Dönüş tarihi gidiş tarihinden önce olamaz!'); return; }

  const days = suptDaysBetween(start, end);

  // Nested path oluştur
  if (!suptState.entries[dept]) suptState.entries[dept] = {};
  if (!suptState.entries[dept][ship]) suptState.entries[dept][ship] = {};
  if (!suptState.entries[dept][ship][monthKey]) suptState.entries[dept][ship][monthKey] = [];
  if (!suptState.ships[dept].includes(ship)) suptState.ships[dept].push(ship);

  suptState.entries[dept][ship][monthKey].push({ name, start, end, days, status });

  suptRenderModalList();
  suptSaveToFirebase();
  suptToast('✓ Kayıt eklendi');

  // Formu sıfırla
  document.getElementById('suptInpName').value = '';
  document.getElementById('suptInpStart').value = '';
  document.getElementById('suptInpEnd').value = '';
  document.getElementById('suptInpStatus').value = '';
  document.getElementById('suptDaysPreview').textContent = '';

  // Arka planda tabloyu güncelle
  suptRenderCurrentTab();
}

function suptDeleteEntry(dept, ship, monthKey, idx) {
  if (!suptState.entries[dept]?.[ship]?.[monthKey]) return;
  suptState.entries[dept][ship][monthKey].splice(idx, 1);
  suptSaveToFirebase();
  suptToast('Kayıt silindi');
  suptRenderCurrentTab();
}

// ─── İLK YÜKLEME ────────────────────────────────────────────────────

function initSuperintendent() {
  // Sekme click handler'larını bağla
  document.querySelectorAll('#superintendentPanel .supt-tab').forEach(btn => {
    btn.addEventListener('click', () => suptTabSwitch(btn.dataset.panel));
  });
  suptLoadFromFirebase();
}
