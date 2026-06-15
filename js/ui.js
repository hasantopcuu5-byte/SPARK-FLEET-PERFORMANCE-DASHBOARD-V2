// ══════════════════════════════════════════════════════
//  WELCOME SCREEN (HOŞGELDİN) LOGIC
// ══════════════════════════════════════════════════════
const welcomeScreen = document.getElementById('welcomeScreen');
const wsCursor = document.getElementById('wsCursor');
const wsContainer = document.querySelector('.ws-container');
let wsFlickerInterval;

if (welcomeScreen) {
    welcomeScreen.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;
        
        if (wsCursor) {
            wsCursor.style.left = x + 'px';
            wsCursor.style.top = y + 'px';
        }
        
        if (wsContainer) {
            const xRotation = (y - window.innerHeight / 2) / 50;
            const yRotation = (x - window.innerWidth / 2) / -50;
            wsContainer.style.transform = `perspective(1000px) rotateX(${xRotation}deg) rotateY(${yRotation}deg)`;
        }
    });

    const wsValues = document.querySelectorAll('.ws-value');
    wsFlickerInterval = setInterval(() => {
        if(wsValues.length > 0) {
            const randomVal = wsValues[Math.floor(Math.random() * wsValues.length)];
            if(Math.random() > 0.95) {
                randomVal.style.color = '#4285f4';
                setTimeout(() => { randomVal.style.color = ''; }, 100);
            }
        }
    }, 500);

    welcomeScreen.addEventListener('click', () => {
        welcomeScreen.classList.add('hidden');
        clearInterval(wsFlickerInterval);
        
        setTimeout(() => {
            observeReveal();
        }, 200);
    });
}

// ══════════════════════
//  NAV
// ══════════════════════
// ══════════════════════════════════════════════════════
//  NAV — GÜNCELLENMİŞ (superintendent eklendi)
// ══════════════════════════════════════════════════════
function navSwitch(page){
    var main   = document.getElementById('userPage'), 
        perf   = document.getElementById('perfPanel'),
        insp   = document.getElementById('inspectorPanel'),
        pscIstat = document.getElementById('pscIstatPanel'),
        supt   = document.getElementById('superintendentPanel');
  
    document.getElementById('navBtnFleet').classList.toggle('active', page==='fleet');
    document.getElementById('navBtnPerf').classList.toggle('active', page==='perf');
    const btnInsp = document.getElementById('navBtnInspector');
    if(btnInsp) btnInsp.classList.toggle('active', page==='inspector');
    const btnPscIstat = document.getElementById('navBtnPscIstat');
    if(btnPscIstat) btnPscIstat.classList.toggle('active', page==='pscIstat');
    const btnSupt = document.getElementById('navBtnSuperintendent');
    if(btnSupt) btnSupt.classList.toggle('active', page==='superintendent');
  
    // Hepsini gizle
    if(main)     main.style.display     = 'none';
    if(perf)   { perf.style.display     = 'none'; perf.classList.remove('active'); }
    if(insp)     insp.style.display     = 'none';
    if(pscIstat) pscIstat.style.display = 'none';
    if(supt)     supt.style.display     = 'none';

    // Seçileni göster
    if(page === 'fleet'){
      if(main) main.style.display = '';
    }
    else if(page === 'perf'){
      if(perf) { perf.style.display = 'block'; perf.classList.add('active'); perfRenderAll(); }
    }
    else if(page === 'inspector'){
      if(insp) { insp.style.display = 'block'; renderInspectorView(); }
    }
    else if(page === 'pscIstat'){
      if(pscIstat) { pscIstat.style.display = 'block'; renderPscIstatView(); }
    }
    else if(page === 'superintendent'){
      if(supt) {
        supt.style.display = 'block';
        // İlk açılışta Firebase'den yükle, sonraki geçişlerde sadece yeniden çiz
        if(typeof initSuperintendent === 'function') {
          if(!window._suptInitialized) {
            window._suptInitialized = true;
            initSuperintendent();
          } else {
            suptRenderCurrentTab();
          }
        }
      }
    }
  }

  // ══════════════════════
//  ADMİN MODAL
// ══════════════════════
function perfOpenAdminModal(){
    document.getElementById('perfAdminModal').classList.add('open');
    document.getElementById('admLockScreen').style.display='flex';
    document.getElementById('admContent').style.display='none';
    document.getElementById('admPinInput').value='';
    document.getElementById('admPinErr').style.display='none';
    document.getElementById('navSidebar').style.display='none'; // Sidebar'ı gizle
  }
  function perfCloseAdminModal(){
    document.getElementById('perfAdminModal').classList.remove('open');
    document.getElementById('admLockScreen').style.display='flex';
    document.getElementById('admContent').style.display='none';
    document.getElementById('admPinInput').value='';
    document.getElementById('navSidebar').style.display='flex'; // Sidebar'ı göster
  }
  function admUnlock(){
    var pin=document.getElementById('admPinInput').value;
    // PERF_PIN yerine doğrudan şifreni yazıyoruz:
    if(pin === "admin123"){ 
      document.getElementById('admLockScreen').style.display='none';
      document.getElementById('admContent').style.display='flex';
      document.getElementById('admPinErr').style.display='none';
      document.getElementById('admPinInput').value='';
      renderEditPersonList();
    } else {
      document.getElementById('admPinErr').style.display='block';
      document.getElementById('admPinInput').value='';
    }
  }
  function admTabSwitch(tab,btn){
    document.querySelectorAll('.adm-tab').forEach(function(b){ b.classList.remove('active'); });
    document.querySelectorAll('.adm-tab-panel').forEach(function(p){ p.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('admTab'+tab.charAt(0).toUpperCase()+tab.slice(1)).classList.add('active');
    
    if(tab==='duzenle') {
        document.getElementById('editShipSelectionWrapper').style.display = 'none';
        document.getElementById('editPersonForm').style.display = 'none';
        document.getElementById('editPastShipForm').style.display = 'none';
        if(document.getElementById('editPersonListWrapper')) document.getElementById('editPersonListWrapper').style.display = 'block';
        renderEditPersonList();
    }
  }
  function toggleSidebar(){
    var sidebar = document.getElementById('navSidebar');
    sidebar.classList.toggle('collapsed');
    // Collapsed durumunu localStorage'a kaydet
    if(sidebar.classList.contains('collapsed')){
      localStorage.setItem('sidebarCollapsed', 'true');
    } else {
      localStorage.removeItem('sidebarCollapsed');
    }
  }
  
  // Sayfa yüklendiğinde collapsed durumunu kontrol et
  // Sayfa yüklendiğinde collapsed durumunu kontrol et
  (function(){
    var wasCollapsed = localStorage.getItem('sidebarCollapsed');
    if(wasCollapsed === 'true'){
      document.getElementById('navSidebar').classList.add('collapsed');
    }
  })(); // <-- Parantezi burada kapatıyoruz ki altındakiler dışarıda kalsın.
  // Manuel Puan Kutusu Aç/Kapat
function toggleManualScore(prefix) {
  var isChecked = document.getElementById(prefix + '_ManualToggle').checked;
  document.getElementById(prefix + '_ManualInputDiv').style.display = isChecked ? 'block' : 'none';
}
  
  // --- AVANS SİSTEMİ AÇ/KAPAT FONKSİYONLARI ---
  function updateAvansBtnUI() {
      var btn = document.getElementById('btnToggleAvans');
      if (!btn) return;
      
      if (avansSistemiAktif) {
          btn.textContent = "AÇIK (ON)";
          btn.style.background = "linear-gradient(135deg, var(--ok), #00b890)";
          btn.style.color = "#000";
          btn.style.border = "none";
          btn.style.boxShadow = "0 0 10px rgba(0,240,184,0.4)";
      } else {
          btn.textContent = "KAPALI (OFF)";
          btn.style.background = "rgba(255,90,114,0.1)";
          btn.style.color = "var(--bad)";
          btn.style.border = "1px solid var(--bad)";
          btn.style.boxShadow = "none";
      }
  }
  
  function toggleAvansSistemi() {
      avansSistemiAktif = !avansSistemiAktif; 
      localStorage.setItem('avansSistemiAktif', avansSistemiAktif); 
      
      updateAvansBtnUI(); 
      perfRenderAll();    
      perfRenderArchive();
  }
  
  // Admin paneli açıldığında butonun rengini ayarla
  var originalAdmUnlock = admUnlock;
  admUnlock = function() {
      originalAdmUnlock();
      updateAvansBtnUI();
  };
  var isComingSoonActive = localStorage.getItem('isComingSoonActive_v1') === 'true';
  function updateComingSoonUI() {
      var btn = document.getElementById('btnToggleComingSoon');
      if (btn) {
          if (isComingSoonActive) {
              btn.textContent = "🟢 COMING SOON EKRANI AÇIK";
              btn.style.background = "linear-gradient(135deg, var(--ok), #00b890)";
              btn.style.color = "#000";
              btn.style.border = "none";
              btn.style.boxShadow = "0 0 10px rgba(0,240,184,0.4)";
          } else {
              btn.textContent = "🔴 COMING SOON EKRANI KAPALI";
              btn.style.background = "rgba(255,90,114,0.1)";
              btn.style.color = "var(--bad)";
              btn.style.border = "1px solid var(--bad)";
              btn.style.boxShadow = "none";
          }
      }
  
      var actualContent = document.getElementById('perfActualContent');
      var csContent = document.getElementById('perfComingSoon');
      
      if (actualContent && csContent) {
          if (isComingSoonActive) {
              actualContent.style.display = 'none'; 
              csContent.style.display = 'flex';     
          } else {
              actualContent.style.display = 'block'; 
              csContent.style.display = 'none';      
          }
      }
  }
