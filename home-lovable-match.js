(function(){
  'use strict';
  const body=document.body;
  const mobileTheme=document.getElementById('mobileThemeToggle');
  if(mobileTheme){mobileTheme.addEventListener('click',()=>{
    body.classList.toggle('dark');
    try {
      localStorage.setItem('m4qri-theme',body.classList.contains('dark')?'dark':'light');
    } catch (_) {
      // Theme remains functional if storage is unavailable.
    }
  });}
})();
