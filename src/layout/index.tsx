import { useRoutes } from 'react-router-dom'
import { routes } from '../routes'

const Layout = () => {
  const element = useRoutes(routes)

  return <div className="min-h-screen">{element}</div>
}

export default Layout
