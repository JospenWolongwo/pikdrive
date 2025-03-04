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
import { Bell, Shield, Globe, Phone, Mail } from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { supabase, user } = useSupabase()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsNotifications: true,
    whatsappNotifications: true,
    darkMode: false,
    language: 'en',
    phoneNumber: '',
    timezone: 'Africa/Douala'
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
      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    }
  }

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <main className="container py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="privacy">
              <Shield className="w-4 h-4 mr-2" />
              Privacy
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <Globe className="w-4 h-4 mr-2" />
              Preferences
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Notification Preferences</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive updates about your rides via email
                    </p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={() => handleToggle('emailNotifications')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Get instant updates via SMS
                    </p>
                  </div>
                  <Switch
                    checked={settings.smsNotifications}
                    onCheckedChange={() => handleToggle('smsNotifications')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>WhatsApp Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive updates through WhatsApp
                    </p>
                  </div>
                  <Switch
                    checked={settings.whatsappNotifications}
                    onCheckedChange={() => handleToggle('whatsappNotifications')}
                  />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Privacy Settings</h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <div className="flex gap-4">
                    <Input
                      type="tel"
                      placeholder="+237 XXX XXX XXX"
                      value={settings.phoneNumber}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        phoneNumber: e.target.value
                      }))}
                    />
                    <Button variant="outline">
                      <Phone className="w-4 h-4 mr-2" />
                      Verify
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email Visibility</Label>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Show my email to other users
                    </p>
                    <Switch
                      checked={settings.emailNotifications}
                      onCheckedChange={() => handleToggle('emailNotifications')}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">General Preferences</h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={settings.language}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      language: e.target.value
                    }))}
                  >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={settings.timezone}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      timezone: e.target.value
                    }))}
                  >
                    <option value="Africa/Douala">Cameroon (GMT+1)</option>
                    <option value="Africa/Lagos">Nigeria (GMT+1)</option>
                    <option value="Africa/Kinshasa">DRC (GMT+1)</option>
                  </select>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSaveSettings}>
            Save Changes
          </Button>
        </div>
      </motion.div>
    </main>
  )
}
