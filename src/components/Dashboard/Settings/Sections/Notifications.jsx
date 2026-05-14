import React from "react";
import { Bell, Volume2, MessageSquare, AtSign, Vibrate } from "lucide-react";
import { useTranslation } from "react-i18next";
import ToggleRow from "./ToggleRow";

export default function Notifications() {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04]">
        <ToggleRow 
          id="notif.enabled"  
          icon={<Bell size={15} />}          
          title={t("settings.notifications.allow")}     
          desc={t("settings.notifications.allowDesc")} 
          defaultValue={true} 
        />
        <ToggleRow 
          id="notif.sound"    
          icon={<Volume2 size={15} />}       
          title={t("settings.notifications.sound")}                   
          desc={t("settings.notifications.soundDesc")} 
          defaultValue={true} 
        />
        <ToggleRow 
          id="notif.preview"  
          icon={<MessageSquare size={15} />} 
          title={t("settings.notifications.preview")}         
          desc={t("settings.notifications.previewDesc")} 
          defaultValue={false} 
        />
        <ToggleRow 
          id="notif.mention"  
          icon={<AtSign size={15} />}        
          title={t("settings.notifications.mentions")}  
          desc={t("settings.notifications.mentionsDesc")} 
          defaultValue={false} 
        />
        <ToggleRow 
          id="notif.vibrate"  
          icon={<Vibrate size={15} />}       
          title={t("settings.notifications.vibrate")}                 
          desc={t("settings.notifications.vibrateDesc")} 
          defaultValue={true} 
        />
      </div>
    </div>
  );
}
