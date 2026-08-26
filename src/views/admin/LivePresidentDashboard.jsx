import React, { useEffect, useState } from 'react'
import { Icon8, IconAlertTriangle } from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { adminApi } from '../../lib/api'
import { getRoleLabel } from '../../lib/constants'

export function LivePresidentDashboard({ user, logout, onNavigate }) {
  const isPresident = user.isPrimaryAdmin || user.role === 'PRESIDENT'
  const [memberCount, setMemberCount] = useState(null)
  const [eventCount, setEventCount] = useState(null)
  const [subStats, setSubStats] = useState({ activeSubscriptions: 0, pendingVerification: 0 })

  // Presidential Directives & To-Dos State
  const [directivesData, setDirectivesData] = useState({
    announcement: '',
    todos: [],
    updatedAt: null,
    updatedBy: null,
  })
  const [loadingDirectives, setLoadingDirectives] = useState(true)
  const [directivesError, setDirectivesError] = useState('')
  const [directivesMessage, setDirectivesMessage] = useState('')

  // Briefing Editor State
  const [isEditingBriefing, setIsEditingBriefing] = useState(false)
  const [briefingDraft, setBriefingDraft] = useState('')
  const [savingBriefing, setSavingBriefing] = useState(false)

  // Add To-Do Modal State
  const [showAddTodoModal, setShowAddTodoModal] = useState(false)
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newTodoDesc, setNewTodoDesc] = useState('')
  const [newTodoPriority, setNewTodoPriority] = useState('HIGH')
  const [newTodoRole, setNewTodoRole] = useState('All Council Leads')
  const [newTodoTargetDate, setNewTodoTargetDate] = useState('')
  const [addingTodo, setAddingTodo] = useState(false)

  // Filter States
  const [filterTab, setFilterTab] = useState('ALL') // ALL, PENDING, COMPLETED
  const [priorityFilter, setPriorityFilter] = useState('ALL')

  function loadDirectives() {
    setLoadingDirectives(true)
    adminApi.getPresidentDirectives()
      .then(res => {
        setDirectivesData(res || { announcement: '', todos: [] })
        setBriefingDraft(res?.announcement || '')
      })
      .catch(() => {})
      .finally(() => setLoadingDirectives(false))
  }

  useEffect(() => {
    let mounted = true
    Promise.all([
      adminApi.listMembers().catch(() => ({ users: [] })),
      adminApi.listEvents().catch(() => ({ events: [] })),
      adminApi.listSubscriptions().catch(() => ({ stats: {} })),
      adminApi.getPresidentDirectives().catch(() => null),
    ]).then(([m, e, s, d]) => {
      if (mounted) {
        setMemberCount(m.users?.length || 0)
        setEventCount(e.events?.length || 0)
        setSubStats(s.stats || {})
        if (d) {
          setDirectivesData(d)
          setBriefingDraft(d.announcement || '')
        }
      }
    }).finally(() => {
      if (mounted) setLoadingDirectives(false)
    })
    return () => { mounted = false }
  }, [])

  async function handleSaveBriefing(e) {
    if (e) e.preventDefault()
    if (!isPresident) return
    setSavingBriefing(true)
    setDirectivesError('')
    setDirectivesMessage('')
    try {
      const updated = {
        ...directivesData,
        announcement: briefingDraft.trim(),
      }
      const res = await adminApi.updatePresidentDirectives(updated)
      setDirectivesData(res.data || updated)
      setIsEditingBriefing(false)
      setDirectivesMessage('Presidential briefing updated.')
      setTimeout(() => setDirectivesMessage(''), 3500)
    } catch (err) {
      setDirectivesError(err.message || 'Failed to update presidential briefing.')
    } finally {
      setSavingBriefing(false)
    }
  }

  async function handleToggleTodo(todoId) {
    const todos = directivesData.todos || []
    const target = todos.find(t => t.id === todoId)
    if (!target) return
    const nextCompleted = !target.completed

    // Optimistic update
    const updatedTodos = todos.map(t => t.id === todoId ? { ...t, completed: nextCompleted, completedAt: nextCompleted ? new Date().toISOString() : null, completedBy: nextCompleted ? (user.profile?.name || user.memberId) : null } : t)
    setDirectivesData(prev => ({ ...prev, todos: updatedTodos }))

    try {
      await adminApi.togglePresidentDirectiveTodo(todoId, nextCompleted)
    } catch (err) {
      // Revert if failed
      setDirectivesData(prev => ({ ...prev, todos }))
      setDirectivesError(err.message || 'Failed to update to-do status.')
    }
  }

  async function handleCreateTodo(e) {
    e.preventDefault()
    if (!isPresident) return
    if (!newTodoTitle.trim()) {
      setDirectivesError('Please enter a directive title.')
      return
    }

    setAddingTodo(true)
    setDirectivesError('')
    try {
      const newEntry = {
        id: `dir-${Date.now()}`,
        title: newTodoTitle.trim(),
        description: newTodoDesc.trim(),
        priority: newTodoPriority,
        assignedRole: newTodoRole.trim() || 'All Council Leads',
        targetDate: newTodoTargetDate.trim() || 'As Scheduled',
        completed: false,
        createdAt: new Date().toISOString(),
      }
      const updatedTodos = [newEntry, ...(directivesData.todos || [])]
      const payload = {
        ...directivesData,
        todos: updatedTodos,
      }
      const res = await adminApi.updatePresidentDirectives(payload)
      setDirectivesData(res.data || payload)
      setShowAddTodoModal(false)
      setNewTodoTitle('')
      setNewTodoDesc('')
      setNewTodoPriority('HIGH')
      setNewTodoRole('All Council Leads')
      setNewTodoTargetDate('')
      setDirectivesMessage('New Presidential directive published.')
      setTimeout(() => setDirectivesMessage(''), 3500)
    } catch (err) {
      setDirectivesError(err.message || 'Failed to create directive to-do.')
    } finally {
      setAddingTodo(false)
    }
  }

  async function handleDeleteTodo(todoId) {
    if (!isPresident) return
    if (!window.confirm('Delete this Presidential directive to-do?')) return
    const filtered = (directivesData.todos || []).filter(t => t.id !== todoId)
    try {
      const payload = {
        ...directivesData,
        todos: filtered,
      }
      const res = await adminApi.updatePresidentDirectives(payload)
      setDirectivesData(res.data || payload)
      setDirectivesMessage('Directive removed.')
      setTimeout(() => setDirectivesMessage(''), 3000)
    } catch (err) {
      setDirectivesError(err.message || 'Failed to delete directive.')
    }
  }

  // Filtered To-dos
  const allTodos = directivesData.todos || []
  const filteredTodos = allTodos.filter(item => {
    if (filterTab === 'PENDING' && item.completed) return false
    if (filterTab === 'COMPLETED' && !item.completed) return false
    if (priorityFilter !== 'ALL' && item.priority !== priorityFilter) return false
    return true
  })

  const pendingCount = allTodos.filter(t => !t.completed).length
  const completedCount = allTodos.filter(t => t.completed).length

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-dashboard" onNavigate={onNavigate} title="COMMAND CENTER">
      <section className="welcome admin-welcome">
        <div>
          <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon8 name="protect" size={14} /> PRESIDENTIAL COMMAND CENTER
          </p>
          <h1>Welcome, {user.name}.</h1>
          <p>{getRoleLabel(user.role)} Command Center · Operational directives, task dispatch, and club access controls.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="outline" type="button" onClick={() => onNavigate('admin-qr-scanner')} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', fontSize: '11px', fontWeight: 700 }}>
            <Icon8 name="faceId" size={17} /> QR ENTRY GATE
          </button>
          <button className="primary" type="button" onClick={() => onNavigate('admin-events')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', fontSize: '11px', fontWeight: 700 }}>
            <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> CREATE EVENT
          </button>
        </div>
      </section>

      {/* Pending Subscriptions Alert */}
      {subStats.pendingVerification > 0 && (
        <div className="pending-alert-banner" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <IconAlertTriangle size={22} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <div>
              <b>{subStats.pendingVerification} student subscription payments waiting for verification</b>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#ffecb3' }}>
                Review and activate memberships to unlock event passes for students.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => onNavigate('admin-subscriptions')}>
            REVIEW PAYMENTS &rarr;
          </button>
        </div>
      )}

      {/* Top Metrics Cards */}
      <section className="stats" style={{ margin: '20px 0 28px' }}>
        <div className="stat" onClick={() => onNavigate('admin-members')} style={{ cursor: 'pointer' }}>
          <i><Icon8 name="idDocs" size={26} /></i>
          <div>
            <p>MEMBERS</p>
            <h2>{memberCount === null ? '...' : memberCount}</h2>
            <small>Registered Accounts</small>
          </div>
        </div>

        <div className="stat" onClick={() => onNavigate('admin-events')} style={{ cursor: 'pointer' }}>
          <i><Icon8 name="realtime" size={26} /></i>
          <div>
            <p>EVENTS</p>
            <h2>{eventCount === null ? '...' : eventCount}</h2>
            <small>Club Catalog</small>
          </div>
        </div>

        <div className="stat green" onClick={() => onNavigate('admin-subscriptions')} style={{ cursor: 'pointer' }}>
          <i><Icon8 name="access" size={26} /></i>
          <div>
            <p>ACTIVE SUBSCRIPTIONS</p>
            <h2>{subStats.activeSubscriptions || 0}</h2>
            <small>Verified Members</small>
          </div>
        </div>

        <div className="stat green">
          <i><Icon8 name="protect" size={26} /></i>
          <div>
            <p>SYSTEM ROLE</p>
            <h2>{user.isPrimaryAdmin ? 'PRIMARY' : user.role.slice(0, 7)}</h2>
            <small>{getRoleLabel(user.role)}</small>
          </div>
        </div>
      </section>

      {directivesMessage && <p className="member-form-success" style={{ marginBottom: '16px' }}>{directivesMessage}</p>}
      {directivesError && <p className="member-form-error" style={{ marginBottom: '16px' }}>{directivesError}</p>}

      {/* ---------------------------------------------------- */}
      {/* PRIMARY PRESIDENT INSTRUCTIONS & DIRECTIVES SECTION */}
      {/* ---------------------------------------------------- */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        
        {/* Presidential Command Broadcast Briefing Card */}
        <article className="member-list-card" style={{ padding: '24px', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--brand-border-subtle)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ display: 'inline-flex', padding: '8px', borderRadius: '10px', background: 'var(--brand-glow)', color: 'var(--brand-primary)' }}>
                <Icon8 name="protect" size={20} />
              </span>
              <div>
                <span className="badge badge-president" style={{ fontSize: '10px', letterSpacing: '0.06em', padding: '2px 8px' }}>
                  PRIMARY PRESIDENT DIRECTIVE
                </span>
                <h3 style={{ font: '700 18px Syne', color: 'var(--text-main)', margin: '4px 0 0' }}>
                  Executive Orders & Operational Briefing
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {directivesData.updatedAt && (
                <small style={{ color: 'var(--text-dim)', fontSize: '11px', fontFamily: 'monospace' }}>
                  Updated: {new Date(directivesData.updatedAt).toLocaleDateString()} by {directivesData.updatedBy || 'President'}
                </small>
              )}
              {isPresident && !isEditingBriefing && (
                <button
                  type="button"
                  className="outline"
                  onClick={() => { setIsEditingBriefing(true); setBriefingDraft(directivesData.announcement || '') }}
                  style={{ fontSize: '11px', padding: '6px 14px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Icon8 name="keySecurity" size={13} /> EDIT BRIEFING
                </button>
              )}
            </div>
          </div>

          {isEditingBriefing ? (
            <form onSubmit={handleSaveBriefing} style={{ marginTop: '12px' }}>
              <textarea
                rows={4}
                value={briefingDraft}
                onChange={e => setBriefingDraft(e.target.value)}
                placeholder="Enter official instructions, guidance, operational protocols, or focus directives for all council members and administrators..."
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--line)',
                  borderRadius: '10px',
                  color: 'var(--text-main)',
                  padding: '12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => setIsEditingBriefing(false)}
                  disabled={savingBriefing}
                  style={{ padding: '6px 14px', fontSize: '11px', background: 'var(--panel-subtle)', color: 'var(--text-main)', border: '1px solid var(--line)' }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={savingBriefing}
                  style={{ padding: '6px 18px', fontSize: '11px', fontWeight: 700 }}
                >
                  {savingBriefing ? 'SAVING BRIEFING…' : 'PUBLISH BRIEFING'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ background: 'var(--panel-subtle)', borderRadius: '12px', padding: '16px 20px', border: '1px solid var(--line)', marginTop: '6px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                {directivesData.announcement || 'No presidential briefing active. The Primary President can publish operational directives using the button above.'}
              </p>
            </div>
          )}
        </article>

        {/* Presidential Action Directives / To-Dos Command Board */}
        <article className="member-list-card" style={{ padding: '24px', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
            <div>
              <p className="eyebrow" style={{ margin: '0 0 4px', fontSize: '10px', color: 'var(--brand-primary)', letterSpacing: '0.06em' }}>
                COUNCIL ACTION ITEMS & DIRECTIVES
              </p>
              <h2 style={{ font: '700 20px Syne', color: 'var(--text-main)', margin: 0 }}>
                Primary President To-Do Directives
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {isPresident
                  ? 'Official tasks and assignments issued exclusively by you to lead coordinators and admins.'
                  : 'Official tasks and directives assigned by the Primary President. Check off tasks when completed.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {isPresident && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => setShowAddTodoModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '8px 16px', fontWeight: 700 }}
                >
                  <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> ADD DIRECTIVE / TASK
                </button>
              )}
            </div>
          </div>

          {/* Filter & Metric Strip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setFilterTab('ALL')}
                style={{
                  fontSize: '11px',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid var(--line)',
                  background: filterTab === 'ALL' ? 'var(--brand-primary)' : 'var(--bg-input)',
                  color: filterTab === 'ALL' ? '#000' : 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                All Directives ({allTodos.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('PENDING')}
                style={{
                  fontSize: '11px',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid var(--line)',
                  background: filterTab === 'PENDING' ? 'var(--brand-primary)' : 'var(--bg-input)',
                  color: filterTab === 'PENDING' ? '#000' : 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('COMPLETED')}
                style={{
                  fontSize: '11px',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid var(--line)',
                  background: filterTab === 'COMPLETED' ? 'var(--brand-primary)' : 'var(--bg-input)',
                  color: filterTab === 'COMPLETED' ? '#000' : 'var(--text-main)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Completed ({completedCount})
              </button>
            </div>

            <div>
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                style={{ height: '32px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '11px' }}
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical Priority</option>
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="ROUTINE">Routine Priority</option>
              </select>
            </div>
          </div>

          {/* Directives List */}
          {loadingDirectives ? (
            <p className="directory-state">Loading presidential directives...</p>
          ) : filteredTodos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--panel-subtle)', borderRadius: '12px', border: '1px dashed var(--line)' }}>
              <Icon8 name="protect" size={32} style={{ color: 'var(--brand-primary)', opacity: 0.7, marginBottom: '8px' }} />
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                {filterTab === 'ALL' ? 'No directives issued yet.' : `No ${filterTab.toLowerCase()} directives found.`}
              </p>
              {isPresident && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => setShowAddTodoModal(true)}
                  style={{ marginTop: '12px', fontSize: '11px', padding: '6px 14px' }}
                >
                  CREATE FIRST DIRECTIVE
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredTodos.map(todo => {
                const isCritical = todo.priority === 'CRITICAL'
                const isHigh = todo.priority === 'HIGH'
                const isMedium = todo.priority === 'MEDIUM'

                const priorityBadgeStyle = isCritical
                  ? { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }
                  : isHigh
                  ? { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }
                  : isMedium
                  ? { background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)' }
                  : { background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }

                return (
                  <div
                    key={todo.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '14px',
                      padding: '16px 18px',
                      borderRadius: '12px',
                      background: todo.completed ? 'rgba(0, 0, 0, 0.2)' : 'var(--bg-input)',
                      border: todo.completed ? '1px solid var(--line)' : '1px solid var(--brand-border-subtle)',
                      transition: 'all 0.2s ease',
                      opacity: todo.completed ? 0.75 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleTodo(todo.id)}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '6px',
                          border: todo.completed ? '2px solid #10b981' : '2px solid var(--line)',
                          background: todo.completed ? '#10b981' : 'transparent',
                          color: '#000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          marginTop: '2px',
                          flexShrink: 0,
                          fontSize: '12px',
                          fontWeight: 800,
                          padding: 0,
                        }}
                        title={todo.completed ? 'Mark pending' : 'Mark completed'}
                      >
                        {todo.completed ? '✓' : ''}
                      </button>

                      {/* Content */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span className="badge" style={{ fontSize: '9px', padding: '1px 7px', ...priorityBadgeStyle }}>
                            {todo.priority || 'ROUTINE'}
                          </span>
                          <span className="badge" style={{ fontSize: '9px', padding: '1px 7px', background: 'var(--panel-subtle)', color: 'var(--text-main)', border: '1px solid var(--line)' }}>
                            {todo.assignedRole || 'All Council Leads'}
                          </span>
                          {todo.targetDate && (
                            <small style={{ color: 'var(--brand-primary)', fontSize: '10px', fontFamily: 'monospace' }}>
                              Due: {todo.targetDate}
                            </small>
                          )}
                        </div>

                        <b style={{
                          fontSize: '14px',
                          color: todo.completed ? 'var(--text-muted)' : 'var(--text-main)',
                          textDecoration: todo.completed ? 'line-through' : 'none',
                          display: 'block',
                        }}>
                          {todo.title}
                        </b>

                        {todo.description && (
                          <p style={{
                            margin: '4px 0 0',
                            fontSize: '12px',
                            color: 'var(--text-dim)',
                            lineHeight: '1.5',
                            textDecoration: todo.completed ? 'line-through' : 'none',
                          }}>
                            {todo.description}
                          </p>
                        )}

                        {todo.completed && todo.completedBy && (
                          <small style={{ display: 'block', marginTop: '6px', color: '#10b981', fontSize: '10px' }}>
                            ✓ Marked complete by {todo.completedBy} {todo.completedAt ? `· ${new Date(todo.completedAt).toLocaleString()}` : ''}
                          </small>
                        )}
                      </div>
                    </div>

                    {/* President Controls */}
                    {isPresident && (
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteTodo(todo.id)}
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '10px',
                            cursor: 'pointer',
                          }}
                          title="Delete directive"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </article>
      </section>

      {/* Add Directive Modal (Primary President Only) */}
      {showAddTodoModal && isPresident && (
        <div className="photo-lightbox" onClick={() => setShowAddTodoModal(false)}>
          <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '16px', border: '1px solid var(--line)', maxWidth: '520px', width: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon8 name="protect" size={20} />
                <h3 style={{ font: '700 18px Syne', color: 'var(--text-main)', margin: 0 }}>
                  Issue Presidential Directive / Task
                </h3>
              </div>
              <button className="lightbox-close" onClick={() => setShowAddTodoModal(false)} style={{ position: 'static' }}>✕</button>
            </div>

            <form onSubmit={handleCreateTodo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="field-label" style={{ fontSize: '11px' }}>Directive Title *</label>
                <input
                  required
                  placeholder="e.g. Audit Hall 4 Audio Equipment & Test Scanners"
                  value={newTodoTitle}
                  onChange={e => setNewTodoTitle(e.target.value)}
                  style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                />
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '11px' }}>Directive Instructions / Details</label>
                <textarea
                  rows={3}
                  placeholder="Detailed specifications, safety instructions, or team requirements..."
                  value={newTodoDesc}
                  onChange={e => setNewTodoDesc(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '10px', fontSize: '12px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="field-label" style={{ fontSize: '11px' }}>Priority Level</label>
                  <select
                    value={newTodoPriority}
                    onChange={e => setNewTodoPriority(e.target.value)}
                    style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                  >
                    <option value="CRITICAL">Critical (Immediate)</option>
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="ROUTINE">Routine Task</option>
                  </select>
                </div>

                <div>
                  <label className="field-label" style={{ fontSize: '11px' }}>Assigned Council Wing</label>
                  <select
                    value={newTodoRole}
                    onChange={e => setNewTodoRole(e.target.value)}
                    style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                  >
                    <option value="All Council Leads">All Council Leads</option>
                    <option value="Event Management">Event Management</option>
                    <option value="PR & Media Team">PR & Media Team</option>
                    <option value="Technical Lead">Technical Leads</option>
                    <option value="Treasurer">Treasury & Logistics</option>
                    <option value="Security & Gate Team">Security & Gate Team</option>
                    <option value="Vice President">Vice President</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '11px' }}>Target Completion Deadline</label>
                <input
                  placeholder="e.g. Friday 4:00 PM / 24h Before Fest / Daily EOD"
                  value={newTodoTargetDate}
                  onChange={e => setNewTodoTargetDate(e.target.value)}
                  style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => setShowAddTodoModal(false)}
                  disabled={addingTodo}
                  style={{ flex: 1, height: '40px', background: 'var(--panel-subtle)', color: 'var(--text-main)', border: '1px solid var(--line)', fontSize: '11px' }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={addingTodo}
                  style={{ flex: 2, height: '40px', fontSize: '11px', fontWeight: 700 }}
                >
                  {addingTodo ? 'PUBLISHING DIRECTIVE…' : 'PUBLISH DIRECTIVE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </LivePortal>
  )
}
