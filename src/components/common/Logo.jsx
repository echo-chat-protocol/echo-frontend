import React from 'react'
import echoLogo from '../Logo/echo-logo.svg'

const Logo = ({ size = 'md', variant = 'default' }) => {
  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20',
  }

  return (
    <img
      src={echoLogo}
      className={`${sizeMap[size]} object-contain transition-all duration-300`}
      alt='Echo Logo'
    />
  )
}

export default Logo
