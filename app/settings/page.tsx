'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSupabase } from '@/providers/SupabaseProvider'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bell, Shield, Globe, Phone, Mail, Sun, Moon, Monitor } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'

export default function SettingsPage() {
  const { supabase, user } = useSupabase()
  const { theme: currentTheme, setTheme: setCurrentTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({
    email_notifications: true,
    sms_notifications: true,
    whatsapp_notifications: true,
    language: 'fr',
    phone_number: '',
    timezone: 'Africa/Douala',
    theme: 'system'
  })

  useEffect(() => {
    const loadSettings = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (data) {
          setSettings(prev => ({
            ...prev,
            ...data
          }))
          // Sync theme with current theme provider
          if (data.theme && data.theme !== currentTheme) {
            setCurrentTheme(data.theme)
          }
        }
      }
      setLoading(false)
    }

    loadSettings()
  }, [user, supabase])

  const handleSaveSettings = async () => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          ...settings
        })

      if (error) throw error
      toast.success('Paramètres sauvegardés avec succès')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Échec de la sauvegarde des paramètres')
    }
  }

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Chargement...</div>
  }

  return (
    <main className="container py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <h1 className="text-3xl font-bold mb-8">Paramètres</h1>

        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="privacy">
              <Shield className="w-4 h-4 mr-2" />
              Confidentialité
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <Globe className="w-4 h-4 mr-2" />
              Préférences
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Préférences de Notifications</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notifications par Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Recevoir les mises à jour sur vos trajets par email
                    </p>
                  </div>
                  <Switch
                    checked={settings.email_notifications}
                    onCheckedChange={() => handleToggle('email_notifications')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notifications SMS</Label>
                    <p className="text-sm text-muted-foreground">
                      Recevoir des mises à jour instantanées par SMS
                    </p>
                  </div>
                  <Switch
                    checked={settings.sms_notifications}
                    onCheckedChange={() => handleToggle('sms_notifications')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notifications WhatsApp</Label>
                    <p className="text-sm text-muted-foreground">
                      Recevoir des mises à jour via WhatsApp
                    </p>
                  </div>
                  <Switch
                    checked={settings.whatsapp_notifications}
                    onCheckedChange={() => handleToggle('whatsapp_notifications')}
                  />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Paramètres de Confidentialité</h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Numéro de Téléphone</Label>
                  <div className="flex gap-4">
                    <Input
                      type="tel"
                      placeholder="+237 XXX XXX XXX"
                      value={settings.phone_number}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        phone_number: e.target.value
                      }))}
                    />
                    <Button variant="outline">
                      <Phone className="w-4 h-4 mr-2" />
                      Vérifier
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Visibilité de l'Email</Label>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Afficher mon email aux autres utilisateurs
                    </p>
                    <Switch
                      checked={settings.email_notifications}
                      onCheckedChange={() => handleToggle('email_notifications')}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Préférences Générales</h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Langue</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={settings.language}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      language: e.target.value
                    }))}
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Fuseau Horaire</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={settings.timezone}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      timezone: e.target.value
                    }))}
                  >
                    <option value="Africa/Douala">Cameroun (GMT+1)</option>
                    <option value="Africa/Lagos">Nigeria (GMT+1)</option>
                    <option value="Africa/Kinshasa">RDC (GMT+1)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Thème</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSettings(prev => ({ ...prev, theme: 'system' }))
                        setCurrentTheme('system')
                      }}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                        settings.theme === 'system' 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Monitor className="w-4 h-4" />
                      <span className="text-sm">Système</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSettings(prev => ({ ...prev, theme: 'light' }))
                        setCurrentTheme('light')
                      }}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                        settings.theme === 'light' 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      <span className="text-sm">Clair</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSettings(prev => ({ ...prev, theme: 'dark' }))
                        setCurrentTheme('dark')
                      }}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                        settings.theme === 'dark' 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      <span className="text-sm">Sombre</span>
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Choisissez votre préférence d'apparence
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSaveSettings}>
            Sauvegarder les Modifications
          </Button>
        </div>
      </motion.div>
    </main>
  )
}
