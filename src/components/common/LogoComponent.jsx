import sodaCan from '/echo-logo.svg'
import './logo.css'

const Logo = () => {
  return (
    <div className='logo-container'>
      <img src={sodaCan} alt='Soda Can' className='logo' />
      <h1>ECHO</h1>
    </div>
  )
}

export default Logo
