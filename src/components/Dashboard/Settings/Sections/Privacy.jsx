import React from "react";
import { Eye, EyeOff, Clock, PenLine, Camera, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import ToggleRow from "./ToggleRow";

export default function Privacy() {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04]">
        <ToggleRow 
          id="priv.readReceipts"  
          icon={<Eye size={15} />}         
          title={t("settings.privacy.readReceipts")}          
          desc={t("settings.privacy.readReceiptsDesc")} 
          defaultValue={true} 
        />
        <ToggleRow 
          id="priv.lastSeen"      
          icon={<Clock size={15} />}       
          title={t("settings.privacy.lastSeen")}         
          desc={t("settings.privacy.lastSeenDesc")} 
          defaultValue={true} 
        />
        <ToggleRow 
          id="priv.typing"        
          icon={<PenLine size={15} />}     
          title={t("settings.privacy.typing")}       
          desc={t("settings.privacy.typingDesc")} 
          defaultValue={true} 
        />
        <ToggleRow 
          id="priv.screenshot"    
          icon={<Camera size={15} />}      
          title={t("settings.privacy.blockScreenshots")}      
          desc={t("settings.privacy.blockScreenshotsDesc")} 
          defaultValue={false} 
        />
        <ToggleRow 
          id="priv.disappearing"  
          icon={<EyeOff size={15} />}      
          title={t("settings.privacy.disappearing")}  
          desc={t("settings.privacy.disappearingDesc")} 
          defaultValue={false} 
        />
        <ToggleRow 
          id="priv.metadata"      
          icon={<ShieldCheck size={15} />} 
          title={t("settings.privacy.metadata")} 
          desc={t("settings.privacy.metadataDesc")} 
          defaultValue={true} 
        />
      </div>
    </div>
  );
}
