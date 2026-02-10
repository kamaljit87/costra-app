import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import { useAuth } from '../contexts/AuthContext'
import { profileAPI, complianceAPI } from '../services/api'
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
  Trash2,
  Download,
  FileText,
  Lock
} from 'lucide-react'

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
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

  // Data management state
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [keepForMarketing, setKeepForMarketing] = useState(true)
  const [deletionRequestId, setDeletionRequestId] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteStep, setDeleteStep] = useState<'initial' | 'confirm'>('initial')

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

  const handleExportData = async () => {
    setIsExporting(true)
    setExportError('')
    try {
      const data = await complianceAPI.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `costra-data-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error: any) {
      setExportError(error.message || 'Failed to export data')
    } finally {
      setIsExporting(false)
    }
  }

  const handleRequestDeletion = async () => {
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const result = await complianceAPI.requestDeletion(deleteReason || undefined)
      setDeletionRequestId(result.request.id)
      setDeleteStep('confirm')
    } catch (error: any) {
      setDeleteError(error.message || 'Failed to create deletion request')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleConfirmDeletion = async () => {
    if (!deletionRequestId) return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await complianceAPI.confirmDeletion(deletionRequestId, keepForMarketing)
      logout()
      navigate('/login')
    } catch (error: any) {
      setDeleteError(error.message || 'Failed to delete account')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleCancelDeletion = async () => {
    if (deletionRequestId) {
      try {
        await complianceAPI.cancelDeletion(deletionRequestId)
      } catch {
        // Ignore cancel errors
      }
    }
    setShowDeleteConfirm(false)
    setDeleteStep('initial')
    setDeletionRequestId(null)
    setDeleteReason('')
    setDeleteError('')
    setKeepForMarketing(true)
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
      <div className="w-full max-w-[1920px] mx-auto px-6 lg:px-12 xl:px-16 py-10">
        {/* Breadcrumbs */}
        <Breadcrumbs />

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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-100 to-accent-50 flex items-center justify-center">
                <Camera className="h-5 w-5 text-accent-700" />
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
                  <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-primary-800 to-accent-600 flex items-center justify-center ring-4 ring-gray-100 shadow-lg">
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
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-100 to-accent-50 flex items-center justify-center">
                  <User className="h-5 w-5 text-accent-700" />
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-100 to-accent-50 flex items-center justify-center">
                <Shield className="h-5 w-5 text-accent-700" />
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

          {/* Data Management Section */}
          <section className="card">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-100 to-accent-50 flex items-center justify-center">
                <FileText className="h-5 w-5 text-accent-700" />
              </div>
              <div className="ml-3">
                <h2 className="text-lg font-semibold text-gray-900">Your Data</h2>
                <p className="text-sm text-gray-500">Download or manage your personal data</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Data Export */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-surface-50 rounded-xl border border-surface-100">
                <div className="mb-3 sm:mb-0">
                  <h3 className="font-medium text-gray-900">Download Your Data</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Export all your data including profile, cloud providers, cost data, budgets, and preferences in JSON format.
                  </p>
                </div>
                <button
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="btn-secondary flex items-center space-x-2 shrink-0"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>{isExporting ? 'Exporting...' : 'Download Data'}</span>
                </button>
              </div>

              {exportError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{exportError}</span>
                </div>
              )}

              {/* Data Security Note */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <Lock className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Your data is stored securely</p>
                  <p className="mt-1 text-blue-700">
                    All credentials are encrypted with AES-256-GCM. Email addresses are stored securely and never shared with third parties.
                    We comply with GDPR and DPDPA data protection regulations.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Delete Account Section */}
          <section className="card border-red-200">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div className="ml-3">
                <h2 className="text-lg font-semibold text-gray-900">Delete Account</h2>
                <p className="text-sm text-gray-500">Permanently remove your account and all data</p>
              </div>
            </div>

            {!showDeleteConfirm ? (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Once you delete your account, all your data will be permanently removed. This includes your profile,
                  cloud provider credentials, cost data, budgets, reports, and all associated records. This action cannot be undone.
                </p>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-xl font-medium flex items-center space-x-2 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete My Account</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {deleteStep === 'initial' ? (
                  <>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-sm text-red-800 font-medium mb-2">Are you sure you want to delete your account?</p>
                      <p className="text-sm text-red-700">
                        This will permanently delete all your data including cloud provider connections,
                        cost history, budgets, and reports. You will not be able to recover any of this data.
                      </p>
                    </div>

                    {/* Reason (optional) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason for leaving (optional)
                      </label>
                      <textarea
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        className="input-field"
                        placeholder="Help us improve by sharing why you're leaving..."
                        rows={2}
                      />
                    </div>

                    {/* Marketing opt-in */}
                    <div className="flex items-start gap-3 p-4 bg-surface-50 rounded-xl border border-surface-100">
                      <input
                        type="checkbox"
                        id="keepForMarketing"
                        checked={keepForMarketing}
                        onChange={(e) => setKeepForMarketing(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500"
                      />
                      <label htmlFor="keepForMarketing" className="text-sm text-gray-700 cursor-pointer">
                        <span className="font-medium">Keep me updated</span>
                        <p className="mt-0.5 text-gray-500">
                          I'd like to receive occasional product updates, blog posts, and tips about cloud cost optimization.
                          You can unsubscribe at any time.
                        </p>
                      </label>
                    </div>

                    {deleteError && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{deleteError}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleRequestDeletion}
                        disabled={deleteLoading}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium flex items-center space-x-2 transition-colors disabled:opacity-50"
                      >
                        {deleteLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span>{deleteLoading ? 'Processing...' : 'Continue with Deletion'}</span>
                      </button>
                      <button
                        onClick={handleCancelDeletion}
                        className="btn-secondary"
                        disabled={deleteLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-sm text-red-800 font-medium mb-2">Final Confirmation</p>
                      <p className="text-sm text-red-700">
                        Click "Permanently Delete" below to irreversibly delete your account and all associated data.
                        {keepForMarketing && ' Your email will be saved for marketing communications as requested.'}
                      </p>
                    </div>

                    {deleteError && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{deleteError}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleConfirmDeletion}
                        disabled={deleteLoading}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium flex items-center space-x-2 transition-colors disabled:opacity-50"
                      >
                        {deleteLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span>{deleteLoading ? 'Deleting...' : 'Permanently Delete'}</span>
                      </button>
                      <button
                        onClick={handleCancelDeletion}
                        className="btn-secondary"
                        disabled={deleteLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  )
}
