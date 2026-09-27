// ──────────────────────────────────────────────────────────
// src/pages/Profile.jsx — Personal profile & account settings
// ──────────────────────────────────────────────────────────

import { useAuth } from "../context/AuthContext";
import { changePassword } from "../services/authApi";
import { useState } from "react";
import "./Operations.css";

const AVATAR_OPTIONS = ["👨‍💼", "👷", "👩‍💼", "🧑‍💼", "👨‍🔧", "👩‍🔧"];

function getDefaultAvatar(isStaff) {
  return isStaff ? "👷" : "👨‍💼";
}

function getRoleLabel(role) {
  if (!role) return "Inventory Manager";
  return role === "WAREHOUSE_STAFF" ? "Warehouse Employee" : "Inventory Manager";
}

export default function Profile() {
  const { user, token, isStaff, loginUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [profileForm, setProfileForm] = useState(() => ({
    name: user?.name || "",
    email: user?.email || "",
    avatar: user?.avatar || getDefaultAvatar(isStaff),
  }));
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  function handleProfileChange(event) {
    const { name, value } = event.target;
    setProfileForm((current) => ({ ...current, [name]: value }));
  }

  function handleAvatarSelect(avatar) {
    setProfileForm((current) => ({ ...current, avatar }));
  }

  function handleEditCancel() {
    setIsEditing(false);
    setProfileMessage("");
    setProfileError("");
    setProfileForm({
      name: user?.name || "",
      email: user?.email || "",
      avatar: user?.avatar || getDefaultAvatar(isStaff),
      role: user?.role || (isStaff ? "WAREHOUSE_STAFF" : "INVENTORY_MANAGER"),
    });
  }

  function openEditProfile() {
    setProfileForm({
      name: user?.name || "",
      email: user?.email || "",
      avatar: user?.avatar || getDefaultAvatar(isStaff),
    });
    setIsEditing(true);
  }

  async function saveProfile(event) {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");

    if (!profileForm.name.trim()) {
      setProfileError("Name is required.");
      return;
    }

    setSavingProfile(true);
    try {
      const nextUser = {
        ...user,
        name: profileForm.name.trim(),
        email: profileForm.email || user?.email || "",
        avatar: profileForm.avatar,
        displayRole: getRoleLabel(user?.role),
      };

      loginUser(token || "mock-jwt-token-stocksense", nextUser);
      setProfileMessage("Profile updated successfully");
      setIsEditing(false);
    } catch (error) {
      setProfileError(error.message || "Unable to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (passwords.next.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordError("New passwords do not match");
      return;
    }

    setSavingPassword(true);
    try {
      const result = await changePassword(passwords.current, passwords.next);
      setPasswordMessage(result.message || result.data?.message || "Password changed successfully");
      setPasswords({ current: "", next: "", confirm: "" });
    } catch (error) {
      setPasswordError(error.message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My Profile</h1>
          <p className="page-header-subtitle">Manage your account details and security</p>
        </div>
      </div>

      <div className="section-card profile-shell">
        <div className="profile-header">
          <div className="profile-avatar">{profileForm.avatar || getDefaultAvatar(isStaff)}</div>
          <div className="profile-meta">
            <h2 className="profile-name">{user?.name || "User"}</h2>
            <span className="profile-role">{getRoleLabel(profileForm.role || user?.role)}</span>
            <div className="profile-actions">
              {!isEditing ? (
                <button type="button" className="btn btn--secondary" onClick={openEditProfile}>
                  Edit Profile
                </button>
              ) : (
                <>
                  <button type="button" className="btn btn--secondary" onClick={handleEditCancel}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={saveProfile} className="profile-edit-form">
            {profileError && <div className="auth-error" role="alert">{profileError}</div>}
            {profileMessage && <div className="auth-success" role="status">{profileMessage}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="profile-name">Full name</label>
              <input
                id="profile-name"
                className="form-input"
                name="name"
                type="text"
                value={profileForm.name}
                onChange={handleProfileChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-email">Email</label>
              <input
                id="profile-email"
                className="form-input"
                name="email"
                type="email"
                value={profileForm.email}
                onChange={handleProfileChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Profile picture</label>
              <div className="avatar-picker">
                {AVATAR_OPTIONS.map((avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    className={`avatar-option ${profileForm.avatar === avatar ? "selected" : ""}`}
                    onClick={() => handleAvatarSelect(avatar)}
                    aria-label={`Set avatar ${avatar}`}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn btn--primary" type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving..." : "Save Changes"}
            </button>
          </form>
        ) : (
          <div className="profile-details">
            <div className="profile-row">
              <span className="profile-label">Full Name</span>
              <span className="profile-value">{user?.name || "—"}</span>
            </div>
            <div className="profile-row">
              <span className="profile-label">Email</span>
              <span className="profile-value">{user?.email || "—"}</span>
            </div>
            <div className="profile-row">
              <span className="profile-label">Role</span>
              <span className="profile-value">{getRoleLabel(user?.role)}</span>
            </div>
            <div className="profile-row">
              <span className="profile-label">Profile Picture</span>
              <span className="profile-value profile-avatar-inline">{user?.avatar || getDefaultAvatar(isStaff)}</span>
            </div>
          </div>
        )}
      </div>

      {isEditing && (
        <section className="section-card profile-shell" style={{ marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>Change Password</h2>
          <form className="auth-form" onSubmit={savePassword}>
            {passwordError && <div className="auth-error" role="alert">{passwordError}</div>}
            {passwordMessage && <div className="auth-success" role="status">{passwordMessage}</div>}
            <div className="form-group">
              <label className="form-label" htmlFor="current-password">Current password</label>
              <input id="current-password" className="form-input" type="password" autoComplete="current-password" required value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-password">New password</label>
              <input id="new-password" className="form-input" type="password" autoComplete="new-password" minLength={8} required value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">Confirm new password</label>
              <input id="confirm-password" className="form-input" type="password" autoComplete="new-password" minLength={8} required value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} />
            </div>
            <button className="btn btn--primary" type="submit" disabled={savingPassword}>
              {savingPassword ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
