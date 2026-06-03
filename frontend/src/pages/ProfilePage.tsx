import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/useAuth';
import type { User } from '../types';
import Topbar from '../components/Topbar';
import ErrorMessage from '../components/ErrorMessage';
import { getApiError } from '../utils/apiError';
import styles from './Profile.module.css';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? (
  import.meta.env.PROD ? window.location.origin : 'http://localhost:4000'
);
const AVATAR_BASE = `${apiBaseUrl}/uploads/avatars/`;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();

  const [profile, setProfile] = useState<User | null>(user);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiClient.get<User>('/api/users/me')
      .then((res) => {
        if (cancelled) return;
        setProfile(res.data);
        updateUser(res.data);
        setEditUsername(res.data.username);
        setEditEmail(res.data.email);
      })
      .catch((err) => {
        if (cancelled) return;
        setProfileErr(getApiError(err));
      });

    return () => {
      cancelled = true;
    };
  }, [updateUser]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('Only JPEG, PNG, and WebP images are allowed');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File must be smaller than 2 MB');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploadError('');
    setUploading(true);
    const formData = new FormData();
    formData.append('avatar', selectedFile);
    try {
      const res = await apiClient.post<User>('/api/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile(res.data);
      updateUser(res.data);
      setSelectedFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(getApiError(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    setSavingProfile(true);
    try {
      const res = await apiClient.patch<User>('/api/users/me', {
        username: editUsername,
        email: editEmail,
      });
      setProfile(res.data);
      updateUser(res.data);
      setProfileMsg('Profile updated successfully');
    } catch (err) {
      setProfileErr(getApiError(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg('');
    setPwdErr('');
    if (newPwd !== confirmPwd) {
      setPwdErr('New passwords do not match');
      return;
    }
    setSavingPwd(true);
    try {
      await apiClient.post('/api/users/me/password', {
        current_password: currentPwd,
        new_password: newPwd,
      });
      await logout();
      navigate('/login', { replace: true, state: { message: 'Password changed. Please sign in again.' } });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err) {
      setPwdErr(getApiError(err));
    } finally {
      setSavingPwd(false);
    }
  }

  const avatarSrc = preview
    ? preview
    : profile?.avatar
      ? `${AVATAR_BASE}${profile.avatar}`
      : null;

  return (
    <div className={styles.page}>
      <Topbar active="profile" />

      <main className={styles.content}>
        <div className={styles.sideCard}>
          <div className={styles.avatarSection}>
            {avatarSrc ? (
              <img src={avatarSrc} alt="Avatar" className={styles.avatar} />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {profile?.username?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <p className={styles.displayName}>{profile?.username}</p>
            <p className={styles.displayEmail}>{profile?.email}</p>
          </div>

          <div className={styles.infoSection}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Username</span>
              <span className={styles.infoValue}>{profile?.username}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Email</span>
              <span className={styles.infoValue}>{profile?.email}</span>
            </div>
          </div>
        </div>

        <div className={styles.rightCol}>
          <div className={styles.mainCard}>
            <h2>Edit Profile</h2>
            <form onSubmit={handleSaveProfile} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Username</label>
                <input
                  className={styles.input}
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  minLength={3}
                  maxLength={30}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Email</label>
                <input
                  className={styles.input}
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                />
              </div>
              {profileErr && <ErrorMessage message={profileErr} />}
              {profileMsg && <p className={styles.success}>{profileMsg}</p>}
              <button className={styles.uploadBtn} type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>

          <div className={styles.mainCard}>
            <h2>Change Password</h2>
            <form onSubmit={handleChangePassword} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Current Password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>New Password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  minLength={12}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Confirm New Password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  required
                />
              </div>
              {pwdErr && <ErrorMessage message={pwdErr} />}
              {pwdMsg && <p className={styles.success}>{pwdMsg}</p>}
              <button className={styles.uploadBtn} type="submit" disabled={savingPwd}>
                {savingPwd ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </div>

          <div className={styles.mainCard}>
            <h2>Change Avatar</h2>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className={styles.fileInput}
            />
            {uploadError && <ErrorMessage message={uploadError} />}
            {selectedFile && (
              <button
                className={styles.uploadBtn}
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Avatar'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
