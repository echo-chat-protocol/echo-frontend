export const WALLPAPER_PREVIEWS = {
  default: {
    name: 'Default',
    preview: 'bg-black',
    fullStyle: 'bg-black',
    type: 'color',
    className: 'bg-black',
  },
  midnight: {
    name: 'Midnight',
    preview: 'bg-gradient-to-br from-[#6a65b0] via-[#514b96] to-[#3a356e]',
    fullStyle: 'bg-gradient-to-br from-[#6a65b0] via-[#514b96] to-[#3a356e]',
    type: 'gradient',
    className: 'bg-gradient-to-br from-[#6a65b0] via-[#514b96] to-[#3a356e]',
  },
  fluid: {
    name: 'Fluid',
    preview: '/wallpapers/fluid.jpg',
    fullStyle: "bg-[url('/wallpapers/fluid.jpg')] bg-cover bg-center",
    type: 'image',
    className: 'bg-cover bg-center',
    imageUrl: '/wallpapers/fluid.jpg',
  },
  mt_fuji: {
    name: 'Mt. Fuji',
    video: '/wallpapers/mt_fuji.mp4',
    poster: '/wallpapers/mt_fuji.jpg',
    fullStyle: 'bg-cover bg-center',
    type: 'video',
    className: 'bg-cover bg-center',
    videoUrl: '/wallpapers/mt_fuji.mp4',
    posterUrl: '/wallpapers/mt_fuji.jpg',
  },
  sunrise: {
    name: 'Sunrise',
    video: '/wallpapers/purple_sunrise.mp4',
    poster: '/wallpapers/purple_sunrise.jpg',
    fullStyle: 'bg-cover bg-center',
    type: 'video',
    className: 'bg-cover bg-center',
    videoUrl: '/wallpapers/purple_sunrise.mp4',
    posterUrl: '/wallpapers/purple_sunrise.jpg',
  },
  sunset: {
    name: 'Sunset',
    video: '/wallpapers/sunset.mp4',
    poster: '/wallpapers/sunset.jpg',
    fullStyle: 'bg-cover bg-center',
    type: 'video',
    className: 'bg-cover bg-center',
    videoUrl: '/wallpapers/sunset.mp4',
    posterUrl: '/wallpapers/sunset.jpg',
  },
}

// Función para obtener el componente de wallpaper según el tipo
export const getWallpaperComponent = (wallpaperKey) => {
  const wp = WALLPAPER_PREVIEWS[wallpaperKey] || WALLPAPER_PREVIEWS.default

  switch (wp.type) {
    case 'video':
      return (
        <div className={`absolute inset-0 overflow-hidden ${wp.className}`}>
          <video
            autoPlay
            loop
            muted
            playsInline
            className='w-full h-full object-cover'
            poster={wp.posterUrl}
          >
            <source src={wp.videoUrl} type='video/mp4' />
          </video>
        </div>
      )
    case 'image':
      return (
        <div
          className={`absolute inset-0 ${wp.className}`}
          style={{ backgroundImage: `url(${wp.imageUrl})` }}
        />
      )
    case 'gradient':
    case 'color':
    default:
      return <div className={`absolute inset-0 ${wp.className}`} />
  }
}

// Función para obtener el estilo de fondo según el tipo de wallpaper
export const getWallpaperStyle = (wallpaperKey) => {
  const wp = WALLPAPER_PREVIEWS[wallpaperKey] || WALLPAPER_PREVIEWS.default

  if (wp.type === 'image') {
    return {
      backgroundImage: `url(${wp.imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }

  return {}
}

// Función para obtener las clases de Tailwind según el tipo de wallpaper
export const getWallpaperClasses = (wallpaperKey) => {
  const wp = WALLPAPER_PREVIEWS[wallpaperKey] || WALLPAPER_PREVIEWS.default
  return wp.className
}
