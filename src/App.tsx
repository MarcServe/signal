import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { Discovery } from './pages/Discovery'
import { Login } from './pages/Login'
import { SignUp } from './pages/SignUp'
import { BecomeArtist } from './pages/BecomeArtist'
import { LiveView } from './pages/LiveView'
import { ArtistProfile } from './pages/ArtistProfile'
import { Dashboard } from './pages/Dashboard'
import { Admin } from './pages/Admin'
import { Onboarding } from './pages/Onboarding'
import { AvatarCreate } from './pages/AvatarCreate'
import { Notifications } from './pages/Notifications'
import { Messages } from './pages/Messages'
import { Settings } from './pages/Settings'
import { SettingsAccount } from './pages/SettingsAccount'
import { SettingsPrivacy } from './pages/SettingsPrivacy'

function MainLayout() {
  return (
    <>
      <Sidebar />
      <div className="flex min-h-screen flex-col pl-14">
        <TopBar />
        {/* min-h-0 so flex children (e.g. mobile discover) can fill below TopBar without forcing page scroll */}
        <main className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </>
  )
}

function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/live/:streamId" element={<LiveView />} />
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/become-artist" element={<BecomeArtist />} />
            <Route path="/onboarding" element={<Onboarding />} />
          </Route>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Discovery />} />
            <Route path="/artist/:artistId" element={<ArtistProfile />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/avatar/create" element={<AvatarCreate />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/account" element={<SettingsAccount />} />
            <Route path="/settings/privacy" element={<SettingsPrivacy />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
