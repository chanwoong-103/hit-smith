function sndCgWatch(sdk){
  try{
    if(!sdk||!sdk.game) return;
    const read=st=>{ SND.cgMute=!!(st&&st.muteAudio); sndApply(); };
    read(sdk.game.settings);
    if(typeof sdk.game.addSettingsChangeListener==='function')
      sdk.game.addSettingsChangeListener(read);
  }catch(e){}
}


