import { useTauri } from '@/hooks/useTauri'
import DesktopSyncView from './DesktopSyncView'
import MobileSyncView from './MobileSyncView'

export default function DeviceSyncModal({ onClose }) {
  const { isMobile } = useTauri()

  return (
    <div className='fixed inset-0 z-[100] overflow-y-auto overflow-x-hidden'>
      {isMobile ? <MobileSyncView onBack={onClose} /> : <DesktopSyncView onBack={onClose} />}
    </div>
  )
}
