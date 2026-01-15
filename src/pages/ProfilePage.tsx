import { useState, useRef, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { profileAPI } from '../services/api'
import { 
  User, 
  Mail, 
  Camera, 
  Shield, 
  Key, 
  Check, 
  X, 
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Upload,
  Trash2
} from 'lucide-react'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Basic info state
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [infoLoading, setInfoLoading] = useState(false)
  const [infoError, setInfoError] = useState('')
  const [infoSuccess, setInfoSuccess] = useState('')
  
  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [avatarSuccess, setAvatarSuccess] = useState('')
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
      setAvatarPreview(user.avatarUrl || null)
    }
  }, [user])

  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    setInfoError('')
    setInfoSuccess('')
    setInfoLoading(true)

    try {
      const result = await profileAPI.updateProfile({ name, email })
      updateUser(result.user)
      setInfoSuccess('Profile updated successfully!')
      setIsEditingInfo(false)
      setTimeout(() => setInfoSuccess(''), 3000)
    } catch (error: any) {
      setInfoError(error.message || 'Failed to update profile')
    } finally {
      setInfoLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setName(user?.name || '')
    setEmail(user?.email || '')
    setIsEditingInfo(false)
    setInfoError('')
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setAvatarError('Please select an image file')
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setAvatarError('Image must be less than 5MB')
        return
      }
      
      setAvatarFile(file)
      setAvatarError('')
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAvatarUpload = async () => {
    if (!avatarFile) return
    
    setAvatarError('')
    setAvatarSuccess('')
    setAvatarLoading(true)

    try {
      const result = await profileAPI.uploadAvatar(avatarFile)
      updateUser({ ...user!, avatarUrl: result.avatarUrl })
      setAvatarSuccess('Avatar updated successfully!')
      setAvatarFile(null)
      setTimeout(() => setAvatarSuccess(''), 3000)
    } catch (error: any) {
      setAvatarError(error.message || 'Failed to upload avatar')
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setAvatarError('')
    setAvatarSuccess('')
    setAvatarLoading(true)

    try {
      await profileAPI.removeAvatar()
      updateUser({ ...user!, avatarUrl: undefined })
      setAvatarPreview(null)
      setAvatarFile(null)
      setAvatarSuccess('Avatar removed successfully!')
      setTimeout(() => setAvatarSuccess(''), 3000)
    } catch (error: any) {
      setAvatarError(error.message || 'Failed to remove avatar')
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    // Validation
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    setPasswordLoading(true)

    try {
      await profileAPI.changePassword(currentPassword, newPassword)
      setPasswordSuccess('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(''), 3000)
    } catch (error: any) {
      setPasswordError(error.message || 'Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++
    if (password.match(/\d/)) strength++
    if (password.match(/[^a-zA-Z\d]/)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength(newPassword)
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500']
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong']

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
          <p className="text-gray-600">
            Manage your personal information and account security
          </p>
        </div>

        <div className="space-y-8">
          {/* Profile Picture Section */}
          <section className="card">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/10 to-accent-500/10 flex items-center justify-center">
                <Camera className="h-5 w-5 text-primary-600" />
              </div>
              <div className="ml-3">
                <h2 className="text-lg font-semibold text-gray-900">Profile Picture</h2>
                <p className="text-sm text-gray-500">Update your photo</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Avatar Preview */}
              <div className="relative group">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profile"
                    className="w-28 h-28 rounded-2xl object-cover ring-4 ring-gray-100 shadow-lg"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center ring-4 ring-gray-100 shadow-lg">
                    <span className="text-white text-4xl font-bold">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                
                {/* Overlay on hover */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                  <Camera className="h-8 w-8 text-white" />
                </button>
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary flex items-center space-x-2"
                    disabled={avatarLoading}
                  >
                    <Upload className="h-4 w-4" />
                    <span>Choose Image</span>
                  </button>

                  {avatarFile && (
                    <button
                      onClick={handleAvatarUpload}
                      className="btn-primary flex items-center space-x-2"
                      disabled={avatarLoading}
                    >
                      {avatarLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span>Save</span>
                    </button>
                  )}

                  {avatarPreview && !avatarFile && (
                    <button
                      onClick={handleRemoveAvatar}
                      className="px-4 py-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl font-medium flex items-center space-x-2 transition-colors"
                      disabled={avatarLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <p className="text-xs text-gray-500">
                  JPG, PNG, GIF or WebP. Max size 5MB.
                </p>

                {avatarError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{avatarError}</span>
                  </div>
                )}

                {avatarSuccess && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                    <Check className="h-4 w-4 flex-shrink-0" />
                    <span>{avatarSuccess}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Basic Information Section */}
          <section className="card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/10 to-accent-500/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary-600" />
                </div>
                <div className="ml-3">
                  <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
                  <p className="text-sm text-gray-500">Your personal details</p>
                </div>
              </div>
              
              {!isEditingInfo && (
                <button
                  onClick={() => setIsEditingInfo(true)}
                  className="btn-ghost text-sm"
                >
                  Edit
                </button>
              )}
            </div>

            <form onSubmit={handleUpdateInfo}>
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Name Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  {isEditingInfo ? (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input-field pl-10"
                        placeholder="Enter your name"
                        required
                      />
                    </div>
                  ) : (
                    <p className="text-gray-900 py-3 px-4 bg-surface-50 rounded-xl">{user?.name}</p>
                  )}
                </div>

                {/* Email Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  {isEditingInfo ? (
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-field pl-10"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  ) : (
                    <p className="text-gray-900 py-3 px-4 bg-surface-50 rounded-xl">{user?.email}</p>
                  )}
                </div>
              </div>

              {infoError && (
                <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{infoError}</span>
                </div>
              )}

              {infoSuccess && (
                <div className="mt-4 flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-3 rounded-xl">
                  <Check className="h-4 w-4 flex-shrink-0" />
                  <span>{infoSuccess}</span>
                </div>
              )}

              {isEditingInfo && (
                <div className="mt-6 flex items-center gap-3">
                  <button
                    type="submit"
                    className="btn-primary flex items-center space-x-2"
                    disabled={infoLoading}
                  >
                    {infoLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span>Save Changes</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="btn-secondary flex items-center space-x-2"
                    disabled={infoLoading}
                  >
                    <X className="h-4 w-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </form>
          </section>

          {/* Security Section */}
          <section className="card">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/10 to-accent-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary-600" />
              </div>
              <div className="ml-3">
                <h2 className="text-lg font-semibold text-gray-900">Security</h2>
                <p className="text-sm text-gray-500">Manage your password</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-5">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input-field pl-10 pr-10"
                    placeholder="Enter current password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field pl-10 pr-10"
                    placeholder="Enter new password"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                
                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i < passwordStrength ? strengthColors[passwordStrength - 1] : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${
                      passwordStrength <= 1 ? 'text-red-600' : 
                      passwordStrength === 2 ? 'text-orange-600' : 
                      passwordStrength === 3 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {passwordStrength > 0 ? strengthLabels[passwordStrength - 1] : 'Too short'} password
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`input-field pl-10 pr-10 ${
                      confirmPassword && confirmPassword !== newPassword
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                        : confirmPassword && confirmPassword === newPassword
                        ? 'border-green-300 focus:border-green-500 focus:ring-green-500/20'
                        : ''
                    }`}
                    placeholder="Confirm new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="mt-2 text-xs text-red-600">Passwords do not match</p>
                )}
                {confirmPassword && confirmPassword === newPassword && newPassword.length >= 8 && (
                  <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Passwords match
                  </p>
                )}
              </div>

              {passwordError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-3 rounded-xl">
                  <Check className="h-4 w-4 flex-shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary flex items-center space-x-2"
                disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              >
                {passwordLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                <span>Change Password</span>
              </button>
            </form>
          </section>

          {/* Account Info */}
          <section className="bg-surface-50 rounded-2xl p-6 border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Account Information</h3>
            <div className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <span className="text-gray-500">Account ID</span>
                <p className="text-gray-900 font-medium mt-1">{user?.id || '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Account Type</span>
                <p className="text-gray-900 font-medium mt-1">Standard</p>
              </div>
              <div>
                <span className="text-gray-500">Member Since</span>
                <p className="text-gray-900 font-medium mt-1">January 2025</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  )
}
