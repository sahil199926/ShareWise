import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/auth-provider'
import { ThemeProvider } from './context/theme-provider'
import Layout from './layout'

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Layout />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
