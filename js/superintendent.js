// ══════════════════════════════════════════════════════════════════════
//  SUPERINTENDENT VISIT SUMMARY — Firebase Entegrasyonlu & Yüksek Kontrastlı Modül
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

// Karanlık temada maksimum okunabilirlik için yüksek kontrastlı neon departman renkleri
const SUPT_DEPT_COLOR = { op:'#5294e2', tek:'#2ecc71', hseq:'#f39c12' }; 
const SUPT_DEPT_BG    = { op:'rgba(66, 133, 244, 0.15)', tek:'rgba(46, 204, 113, 0.15)', hseq:'rgba(243, 156, 18, 0.15)' };

// Departman bazlı sekmelerdeki durum rozetleri için yüksek görünürlüklü soft/açık renkler
const SUPT_STATUS_CLS = {
  'Seyir':   { bg:'rgba(46, 204, 113, 0.2)', color:'#2ecc71', border:'rgba(46, 204, 113, 0.4)' },
  'Liman':   { bg:'rgba(241, 196, 15, 0.2)', color:'#f1c40f', border:'rgba(241, 196, 15, 0.4)' },
  'Demir':   { bg:'rgba(52, 152, 219, 0.2)', color:'#3498db', border:'rgba(52, 152, 219, 0.4)' },
  'Tersane': { bg:'rgba(231, 76, 60, 0.2)',  color:'#e74c3c', border:'rgba(231, 76, 60, 0.4)' }
};

let suptState = {
  ships: { op:[...SUPT_SHIPS], tek:[...SUPT_SHIPS], hseq:[...SUPT_SHIPS] },
  entries: { op:{}, tek:{}, hseq:{} }
};

let suptCurrentTab = 'p-toplam';   
let suptCurrentYear = new Date().getFullYear().toString(); // YIL SEÇİMİ GLOBAL DEĞİŞKENİ
let suptModalCtx   = null;         
let suptSaving     = false;

// ─── YARDIMCI FONKSİYONLAR ──────────────────────────────────────────

function suptMonthKey(year, monthIdx) {
  return `${year}-${String(monthIdx + 1).padStart(2,'0')}`;
}

function suptMonthLabel(key) {
  if (!key) return '';
  const [y, m] = key.split('-');
  return `${SUPT_MONTHS_TR[parseInt(m,10)-1]} ${y}`;
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
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:rgba(10, 22, 26, 0.95);backdrop-filter:blur(10px);border:1px solid var(--teal);color:#fff;padding:12px 20px;border-radius:6px;font-size:13px;z-index:9999;opacity:0;transform:translateY(10px);transition:all .3s;pointer-events:none;font-family:inherit;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateY(0)';
  clearTimeout(t._to);
  t._to = setTimeout(() => { t.style.opacity='0'; t.style.transform='translateY(10px)'; }, dur);
}

// ─── FIREBASE ENTEGRASYONU ──────────────────────────────────────────

async function suptLoadFromFirebase() {
  const wrap = document.getElementById('suptLoadingWrap');
  if (wrap) wrap.style.display = 'flex';
  
  try {
    const res = await fetch(SUPT_FB_URL);
    const raw = await res.json();
    
    let hasData = false;
    if (raw && raw.entries && raw.entries.op) {
        if (Object.keys(raw.entries.op).length > 0) hasData = true;
    }

    if (hasData) {
      suptState.ships   = raw.ships;
      suptState.entries = raw.entries;
      console.log("Firebase superintendent verileri yüklendi.");
    }
  } catch(e) {
    console.error('Superintendent Firebase yükleme hatası:', e);
    suptToast('⚠️ Veriler yüklenemedi, bağlantıyı kontrol edin.', 4000);
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
  } finally {
    suptSaving = false;
  }
}

// ─── SEKME YÖNETİMİ (ZORLU DISPLAY GÜNCELLEMESİ) ──────────────────────────────

// Yıl seçim fonksiyonu
window.suptSetYear = function(year) {
  suptCurrentYear = year;
  suptRenderCurrentTab();
};

function suptTabSwitch(panelId) {
  suptCurrentTab = panelId;
  
  document.querySelectorAll('#superintendentPanel .supt-tab').forEach(t => {
    const isActive = t.dataset.panel === panelId;
    t.classList.toggle('active', isActive);
    
    if (isActive) {
       t.style.background = 'rgba(0, 216, 200, 0.15)';
       t.style.color = 'var(--teal)';
    } else {
       t.style.background = 'transparent';
       t.style.color = 'var(--muted)';
    }
  });
  
  // HTML inline style="display:none" baskınlığını tamamen ezerek görünür yapıyoruz
  document.querySelectorAll('#superintendentPanel .supt-panel').forEach(p => {
    if (p.id === panelId) {
      p.style.setProperty('display', 'block', 'important');
      p.classList.add('active');
    } else {
      p.style.setProperty('display', 'none', 'important');
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
  
  // Tablolara transparan mat cam arkaplanı ve kenarlık ekle
  setTimeout(() => {
      document.querySelectorAll('#superintendentPanel .tbl-wrap, #superintendentPanel .etbl-wrap').forEach(wrapper => {
          if(wrapper) {
              wrapper.style.setProperty('background', 'rgba(14, 32, 36, 0.75)', 'important');
              wrapper.style.backdropFilter = 'blur(16px)';
              wrapper.style.WebkitBackdropFilter = 'blur(16px)';
              wrapper.style.border = '1px solid rgba(0, 216, 200, 0.15)';
              wrapper.style.borderRadius = '12px';
              wrapper.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
              wrapper.style.overflow = 'auto';
          }
      });

      document.querySelectorAll('#superintendentPanel table').forEach(tbl => {
          let theadTr = tbl.querySelector('thead tr');
          if (theadTr) {
              theadTr.style.setProperty('background', 'rgba(0, 0, 0, 0.45)', 'important');
              theadTr.style.setProperty('color', 'var(--text)', 'important');
          }
          // İçerideki beyaz çizgileri / sütun arka planlarını sıfırla
          tbl.querySelectorAll('td').forEach(td => {
              if(!td.classList.contains('sname')) {
                  td.style.backgroundColor = 'transparent';
              }
          });
      });
  }, 30);
}

// ─── VERİ AYIKLAMA (GÜVENLİ KATMAN) ──────────────────────────────────────────

function suptGetAllEntries() {
  const result = [];
  SUPT_DEPTS.forEach(dept => {
    const deptEntries = suptState.entries[dept] || {};
    Object.keys(deptEntries).forEach(ship => {
      const monthMap = deptEntries[ship] || {};
      Object.keys(monthMap).forEach(mk => {
        const rawArr = monthMap[mk];
        const list = Array.isArray(rawArr) ? rawArr : Object.values(rawArr || {});
        list.forEach(e => {
          if (e) result.push({ ...e, dept, ship, monthKey: mk });
        });
      });
    });
  });
  return result;
}

function suptGetExtendedMonthKeys(allEntries) {
  const existing = new Set(allEntries.map(e => e.monthKey));
  let minKey = '2025-08'; // Eski şablon kaydı varsa diye
  existing.forEach(k => { if (k < minKey) minKey = k; });

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

function suptGetAllShips() {
  const s = new Set([...SUPT_SHIPS]);
  SUPT_DEPTS.forEach(dept => {
    (suptState.ships[dept] || []).forEach(sh => s.add(sh));
  });
  return [...s];
}

// ─── GENEL ÖZET ─────────────────────────────────────────────────────

function suptRenderToplam() {
  const allEntries = suptGetAllEntries();
  const totalVisits = allEntries.length;
  const totalDays   = allEntries.reduce((s, e) => s + (e.days || 0), 0);
  const uniqueNames = new Set(allEntries.map(e => e.name)).size;

  if (document.getElementById('suptCardVisits')) document.getElementById('suptCardVisits').textContent = totalVisits;
  if (document.getElementById('suptCardDays')) document.getElementById('suptCardDays').textContent   = totalDays;
  if (document.getElementById('suptCardPeople')) document.getElementById('suptCardPeople').textContent = uniqueNames;

  const byMonth = {};
  allEntries.forEach(e => {
    if (!byMonth[e.monthKey]) byMonth[e.monthKey] = [];
    byMonth[e.monthKey].push(e);
  });

  const sortedKeys = Object.keys(byMonth).sort().reverse();
  let html = '';
  sortedKeys.forEach(mk => {
    html += `<tr><td colspan="7" style="background:rgba(0, 216, 200, 0.12);color:var(--teal);border-bottom:1px solid rgba(0,216,200,0.25);font-weight:700;font-size:12px;letter-spacing:1px;padding:8px 12px;text-align:left;">▼ ${suptMonthLabel(mk)}</td></tr>`;
    byMonth[mk].forEach(e => {
      const dCls = SUPT_DEPT_COLOR[e.dept] || '#888';
      const dLabel = SUPT_DEPT_LABEL[e.dept] || e.dept;
      html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.04); color:var(--text);">
        <td style="padding:8px 12px;font-family:'DM Mono'; font-size:11px; text-align:left;">${suptMonthLabel(mk)}</td>
        <td style="padding:8px 12px;text-align:left;">${e.name}</td>
        <td style="padding:8px 12px;font-weight:700;color:var(--teal);text-align:left;">${e.ship}</td>
        <td style="padding:8px 12px;text-align:left;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dCls};margin-right:5px;box-shadow:0 0 5px ${dCls};"></span>${dLabel}
        </td>
        <td style="padding:8px 12px;font-weight:700;color:var(--warn);text-align:left;">${e.days}</td>
        <td style="padding:8px 12px;font-family:'DM Mono'; font-size:11px;text-align:left;">${suptFmtDate(e.start)}</td>
        <td style="padding:8px 12px;font-family:'DM Mono'; font-size:11px;text-align:left;">${suptFmtDate(e.end)}</td>
      </tr>`;
    });
  });
  const tBody = document.getElementById('suptToplamBody');
  if (tBody) tBody.innerHTML = html || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--muted);">Henüz kayıt yok.</td></tr>';
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
      <td style="padding:9px 12px;font-weight:700;text-align:left;">${name}</td>
      <td style="padding:9px 12px;text-align:left;">${deptBadges}</td>
      <td style="padding:9px 12px;font-weight:900;color:var(--ok);text-align:left;">${d.days}</td>
      <td style="padding:9px 12px;text-align:left;">${d.visits}</td>
      <td style="padding:9px 12px;color:var(--muted);text-align:left;">${[...d.ships].join(', ')}</td>
    </tr>`;
  });
  const cBody = document.getElementById('suptCalisanBody');
  if (cBody) cBody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--muted);">Henüz kayıt yok.</td></tr>';
}

// ─── ZİYARET TABLOSU (YIL FİLTRELİ) ──────────────────────────────────

function suptRenderBulk() {
  const allEntries = suptGetAllEntries();
  const allMonths = suptGetExtendedMonthKeys(allEntries);
  const allShips  = suptGetAllShips();

  // Yıl Sekmeleri Oluşturma
  const years = [...new Set(allMonths.map(k => k.split('-')[0]))].sort();
  if (!years.includes(suptCurrentYear) && years.length > 0) suptCurrentYear = years[0];

  let yearTabsHtml = '<div style="display:flex; gap:8px; margin-bottom:14px; align-items:center;">';
  yearTabsHtml += '<span style="color:var(--muted); font-size:12px; font-weight:bold; margin-right:8px;">YIL SEÇİMİ:</span>';
  years.forEach(y => {
    const isActive = (y === suptCurrentYear);
    const bg = isActive ? 'rgba(0, 216, 200, 0.2)' : 'rgba(255, 255, 255, 0.05)';
    const col = isActive ? 'var(--teal)' : 'var(--muted)';
    const border = isActive ? '1px solid var(--teal)' : '1px solid transparent';
    yearTabsHtml += `<button onclick="suptSetYear('${y}')" style="background:${bg}; color:${col}; border:${border}; padding:6px 16px; border-radius:20px; font-weight:bold; cursor:pointer; font-size:12px; transition:all 0.2s;">${y}</button>`;
  });
  yearTabsHtml += '</div>';

  // Seçilen Yıla Ait Ayları Filtrele
  const filteredMonths = allMonths.filter(mk => mk.startsWith(suptCurrentYear));

  let thHtml = '<th style="text-align:left;padding:10px;background:rgba(10, 22, 26, 0.95);color:var(--muted);position:sticky;left:0;min-width:130px;border-bottom:1px solid rgba(0,216,200,0.25);z-index:3;">GEMİ</th>';
  filteredMonths.forEach(mk => {
    thHtml += `<th style="padding:10px;background:rgba(0,0,0,0.5);color:var(--muted);text-align:center;white-space:nowrap;border-bottom:1px solid rgba(0,216,200,0.25);">${suptMonthLabel(mk)}</th>`;
  });

  // Üst taraftaki "Ofiste Kalan" satırı
  const totalInspectors = typeof getAllNames === 'function' ? getAllNames().length : 3;
  let tbodyHtml = `<tr style="background:rgba(0,216,200,0.03); border-bottom:1px solid rgba(0,216,200,0.15);">
    <td style="position:sticky; left:0; background:rgba(14,32,36,0.95); color:var(--warn); font-weight:700; text-align:left; z-index:2; border-right:1px solid rgba(0,216,200,0.15);">OFİSTE KALAN ENSPEKTÖR SAYISI</td>`;
  filteredMonths.forEach(mk => {
    const namesOnShips = new Set();
    SUPT_DEPTS.forEach(dept => {
      Object.keys(suptState.entries[dept] || {}).forEach(ship => {
        const rawArr = suptState.entries[dept][ship]?.[mk];
        const list = Array.isArray(rawArr) ? rawArr : Object.values(rawArr || {});
        list.forEach(e => { if(e) namesOnShips.add(e.name); });
      });
    });
    const remaining = totalInspectors - namesOnShips.size;
    tbodyHtml += `<td style="font-size:13px; color:#fff; font-weight:800; text-align:center; font-family:'DM Mono';">${remaining} <span style="font-size:10px; font-weight:normal; color:var(--muted);">/ ${totalInspectors}</span></td>`;
  });
  tbodyHtml += '</tr>';

  // Gemi satırları
  allShips.forEach(ship => {
    let row = `<td style="padding:7px 10px;font-weight:700;background:rgba(14,32,36,0.95);color:var(--text);position:sticky;left:0;z-index:2;border-right:1px solid rgba(0,216,200,0.15);border-bottom:1px solid rgba(0,216,200,0.05); text-align:left;">${ship}</td>`;
    filteredMonths.forEach(mk => {
      let chips = '';
      SUPT_DEPTS.forEach(dept => {
        const rawArr = suptState.entries[dept]?.[ship]?.[mk];
        const entries = Array.isArray(rawArr) ? rawArr : Object.values(rawArr || {});
        
        if (entries.length > 0) {
            const label = dept.toUpperCase();
            const col = SUPT_DEPT_COLOR[dept];
            const bg  = SUPT_DEPT_BG[dept];
            chips += `<span class="xm" style="display:inline-block; background:${bg}; color:${col}; border:1px solid ${col}; padding:3px 6px; border-radius:4px; font-size:10px; font-weight:800; margin:2px; letter-spacing:0.5px;">${label}</span>`;
        }
      });
      row += `<td style="padding:6px 8px;text-align:center;border-bottom:1px solid rgba(0,216,200,0.05);vertical-align:middle;">${chips || '<span style="color:rgba(255,255,255,0.05);font-size:11px;">—</span>'}</td>`;
    });
    tbodyHtml += `<tr style="transition:background 0.2s;" onmouseover="this.style.background='rgba(0,216,200,0.03)'" onmouseout="this.style.background='transparent'">${row}</tr>`;
  });

  const container = document.getElementById('suptBulkTable');
  if (container) {
    container.innerHTML = yearTabsHtml + `
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr>${thHtml}</tr></thead>
        <tbody>${tbodyHtml}</tbody>
      </table>`;
  }
}

// ─── DEPARTMAN GİRİŞ TABLOSU (YIL FİLTRELİ & GEMİ İSMİ EKLİ) ───────────────────

function suptRenderDept(dept) {
  const ships = suptState.ships[dept] || [...SUPT_SHIPS];
  const allEntries = suptGetAllEntries();
  const allMonthKeys = suptGetExtendedMonthKeys(allEntries);

  // Yıl Sekmeleri Oluşturma
  const years = [...new Set(allMonthKeys.map(k => k.split('-')[0]))].sort();
  if (!years.includes(suptCurrentYear) && years.length > 0) suptCurrentYear = years[0];

  let yearTabsHtml = '<div style="display:flex; gap:8px; margin-bottom:14px; align-items:center;">';
  yearTabsHtml += '<span style="color:var(--muted); font-size:12px; font-weight:bold; margin-right:8px;">YIL SEÇİMİ:</span>';
  years.forEach(y => {
    const isActive = (y === suptCurrentYear);
    const bg = isActive ? 'rgba(0, 216, 200, 0.2)' : 'rgba(255, 255, 255, 0.05)';
    const col = isActive ? 'var(--teal)' : 'var(--muted)';
    const border = isActive ? '1px solid var(--teal)' : '1px solid transparent';
    yearTabsHtml += `<button onclick="suptSetYear('${y}')" style="background:${bg}; color:${col}; border:${border}; padding:6px 16px; border-radius:20px; font-weight:bold; cursor:pointer; font-size:12px; transition:all 0.2s;">${y}</button>`;
  });
  yearTabsHtml += '</div>';

  // Seçilen Yıla Ait Ayları Filtrele
  const filteredMonths = allMonthKeys.filter(mk => mk.startsWith(suptCurrentYear));

  let thHtml = `<th style="background:rgba(0,0,0,0.5);color:var(--muted);padding:9px 12px;text-align:left;position:sticky;left:0;min-width:130px;border-bottom:1px solid rgba(0,216,200,0.2);z-index:3;">GEMİ</th>`;
  filteredMonths.forEach(mk => {
    const isPresent = mk === new Date().toISOString().slice(0,7);
    thHtml += `<th style="background:rgba(0,0,0,0.5);color:${isPresent?'var(--gold)':'var(--muted)'};padding:9px 8px;text-align:center;min-width:160px;white-space:nowrap;border-bottom:1px solid rgba(0,216,200,0.2);${isPresent?'border-bottom:2px solid var(--gold);':''}">${suptMonthLabel(mk)}</th>`;
  });

  let tbodyHtml = '';
  ships.forEach(ship => {
    let row = `<td style="padding:8px 12px;font-weight:700;font-size:13px;background:rgba(14,32,36,0.95);color:var(--text);position:sticky;left:0;z-index:2;border-right:1px solid rgba(0,216,200,0.15);border-bottom:1px solid rgba(0,216,200,0.05); text-align:left;">${ship}</td>`;
    filteredMonths.forEach(mk => {
      const rawArr = suptState.entries[dept]?.[ship]?.[mk];
      const entries = Array.isArray(rawArr) ? rawArr : Object.values(rawArr || {});
      
      let cellInner = '';
      entries.forEach((e, idx) => {
        if(!e) return;
        const stStyle = SUPT_STATUS_CLS[e.status] || {};
        const stHtml = e.status && e.status !== '-' ? `<span style="display:inline-block;background:${stStyle.bg};color:${stStyle.color};border:1px solid ${stStyle.border};border-radius:4px;font-size:10px;padding:2px 6px;font-weight:700;margin-top:6px;letter-spacing:0.3px;">${e.status}</span>` : '';
        
        // İsmin altına gemi adı eklendi
        cellInner += `
          <div style="background:rgba(0,0,0,0.5);border:1px solid rgba(0,216,200,0.2);border-radius:8px;padding:8px 10px;margin-bottom:6px;position:relative;text-align:left;box-shadow:0 3px 6px rgba(0,0,0,0.2);">
            <div style="font-weight:700;color:#ffffff;font-size:13px;letter-spacing:0.3px;">${e.name}</div>
            <div style="font-weight:bold;color:var(--teal);font-size:11.5px;margin-top:4px;margin-bottom:2px;">🚢 ${ship}</div>
            <div style="color:rgba(150,210,200,0.8);font-family:'DM Mono';font-size:11px;margin-bottom:2px;">${suptFmtDate(e.start)} → ${suptFmtDate(e.end)}</div>
            ${stHtml}
            <span style="background:var(--teal);color:#000;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:800;position:absolute;top:6px;right:6px;box-shadow:0 0 4px var(--teal);">${e.days}g</span>
            <span onclick="event.stopPropagation();suptDeleteEntry('${dept}','${ship}','${mk}',${idx})" style="position:absolute;bottom:6px;right:6px;font-size:12px;color:var(--bad);cursor:pointer;font-weight:bold;padding:2px 4px;" title="Sil">✕</span>
          </div>`;
      });
      
      const isFuture = mk >= new Date().toISOString().slice(0,7);
      const cellBg = isFuture && mk > new Date().toISOString().slice(0,7) ? 'rgba(0,0,0,0.25)' : (entries.length ? 'rgba(0,216,200,0.03)' : 'transparent');
      
      row += `<td onclick="suptOpenModal('${dept}','${ship}','${mk}')" style="min-height:56px;padding:6px;cursor:pointer;vertical-align:top;border-bottom:1px solid rgba(0,216,200,0.05);border-right:1px solid rgba(0,216,200,0.05);background:${cellBg};transition:background .2s;" onmouseover="this.style.background='rgba(0,216,200,0.08)'" onmouseout="this.style.background='${cellBg}'">
        ${cellInner}
        <div style="display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.12);font-size:22px;height:24px;margin-top:4px;transition:color 0.2s;" onmouseover="this.style.color='var(--teal)'" onmouseout="this.style.color='rgba(255,255,255,0.12)'">+</div>
      </td>`;
    });
    tbodyHtml += `<tr>${row}</tr>`;
  });

  const containerId = `suptDeptTable_${dept}`;
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = yearTabsHtml + `
      <div style="overflow:auto;border-radius:6px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr>${thHtml}</tr></thead>
          <tbody>${tbodyHtml}</tbody>
        </table>
      </div>`;
  }
}

// ─── MODAL KONTROLLERİ ───────────────────────────────────────────────

function suptOpenModal(dept, ship, monthKey) {
  suptModalCtx = { dept, ship, monthKey };
  document.getElementById('suptModalTitle').textContent = `${ship} — ${suptMonthLabel(monthKey)}`;
  document.getElementById('suptModalDeptBadge').textContent = SUPT_DEPT_LABEL[dept];
  document.getElementById('suptModalDeptBadge').style.cssText = `padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${SUPT_DEPT_BG[dept]};color:${SUPT_DEPT_COLOR[dept]}`;

  document.getElementById('suptInpName').value = '';
  document.getElementById('suptInpStart').value = '';
  document.getElementById('suptInpEnd').value = '';
  document.getElementById('suptInpStatus').value = '';
  document.getElementById('suptDaysPreview').textContent = '';

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
  const rawArr = suptState.entries[dept]?.[ship]?.[monthKey];
  const entries = Array.isArray(rawArr) ? rawArr : Object.values(rawArr || {});
  
  let html = '';
  entries.forEach((e, idx) => {
    if(!e) return;
    html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.05);border-radius:4px;margin-bottom:6px;font-size:12px;border:1px solid rgba(255,255,255,0.1);">
      <div>
        <span style="font-weight:600;color:var(--text);">${e.name}</span>
        <span style="color:var(--muted);font-size:11px;margin-left:8px;">${suptFmtDate(e.start)} → ${suptFmtDate(e.end)}</span>
        ${e.status ? `<span style="margin-left:6px;font-size:11px;font-weight:700;color:${(SUPT_STATUS_CLS[e.status]||{}).color||'var(--text)'};">${e.status}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="background:var(--teal);color:#000;border-radius:3px;padding:2px 7px;font-size:11px;font-weight:800;">${e.days}g</span>
        <span onclick="suptDeleteEntry('${dept}','${ship}','${monthKey}',${idx});suptRenderModalList();" style="cursor:pointer;color:var(--bad);font-size:14px;padding:0 4px;" title="Sil">✕</span>
      </div>
    </div>`;
  });
  document.getElementById('suptModalList').innerHTML = html || '<div style="color:var(--muted);font-size:12px;padding:8px 0;">Henüz kayıt yok.</div>';
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

  if (!suptState.entries[dept]) suptState.entries[dept] = {};
  if (!suptState.entries[dept][ship]) suptState.entries[dept][ship] = {};
  
  const rawArr = suptState.entries[dept][ship][monthKey];
  if (!Array.isArray(rawArr)) suptState.entries[dept][ship][monthKey] = Object.values(rawArr || {});
  
  if (!suptState.ships[dept].includes(ship)) suptState.ships[dept].push(ship);

  suptState.entries[dept][ship][monthKey].push({ name, start, end, days, status });

  suptRenderModalList();
  suptSaveToFirebase();
  suptToast('✓ Kayıt eklendi');

  document.getElementById('suptInpName').value = '';
  document.getElementById('suptInpStart').value = '';
  document.getElementById('suptInpEnd').value = '';
  document.getElementById('suptInpStatus').value = '';
  document.getElementById('suptDaysPreview').textContent = '';

  suptRenderCurrentTab();
}

function suptDeleteEntry(dept, ship, monthKey, idx) {
  const rawArr = suptState.entries[dept]?.[ship]?.[monthKey];
  if(!rawArr) return;
  
  let entries = Array.isArray(rawArr) ? rawArr : Object.values(rawArr);
  entries.splice(idx, 1);
  suptState.entries[dept][ship][monthKey] = entries; 
  
  suptSaveToFirebase();
  suptToast('Kayıt silindi');
  suptRenderCurrentTab();
}

// ─── BAŞLANGIÇ ──────────────────────────────────────────────────────

function initSuperintendent() {
  document.querySelectorAll('#superintendentPanel .supt-tab').forEach(btn => {
    btn.addEventListener('click', () => suptTabSwitch(btn.dataset.panel));
  });
  suptLoadFromFirebase();
}
