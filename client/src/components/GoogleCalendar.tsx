import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './GoogleCalendar.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: {
    'pt-BR': ptBR,
  },
});

interface GoogleEvent {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  local?: string;
  link?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: any;
}

interface GoogleCalendarProps {
  empresaId: number;
}

export default function GoogleCalendar({ empresaId }: GoogleCalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    start: '',
    end: '',
    location: '',
    createMeet: false,
  });

  const token = localStorage.getItem('auth_token') || '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchEvents = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/google/eventos?start=${start.toISOString()}&end=${end.toISOString()}&maxResults=250`,
        { credentials: 'include', headers }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar eventos');

      const calendarEvents: CalendarEvent[] = data.eventos.map((event: GoogleEvent) => ({
        id: event.id,
        title: event.titulo,
        start: new Date(event.inicio),
        end: new Date(event.fim),
        resource: event,
      }));
      setEvents(calendarEvents);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar eventos');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    fetchEvents(start, end);
  }, [currentDate, fetchEvents]);

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    setNewEvent({
      title: '',
      description: '',
      start: format(start, "yyyy-MM-dd'T'HH:mm"),
      end: format(end, "yyyy-MM-dd'T'HH:mm"),
      location: '',
      createMeet: false,
    });
    setIsCreateDialogOpen(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setNewEvent({
      title: event.title,
      description: event.resource?.description || '',
      start: format(event.start, "yyyy-MM-dd'T'HH:mm"),
      end: format(event.end, "yyyy-MM-dd'T'HH:mm"),
      location: event.resource?.local || '',
      createMeet: false,
    });
    setIsEditDialogOpen(true);
  };

  const createEvent = async () => {
    if (!newEvent.title || !newEvent.start) return;

    try {
      const response = await fetch('/api/google/eventos', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          titulo: newEvent.title,
          descricao: newEvent.description,
          local: newEvent.location,
          dataHoraInicio: newEvent.start,
          duracaoMinutos: Math.round((new Date(newEvent.end).getTime() - new Date(newEvent.start).getTime()) / (1000 * 60)),
          criarMeet: newEvent.createMeet,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao criar evento');

      toast.success('Evento criado com sucesso!');
      setIsCreateDialogOpen(false);
      // Refresh events
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      fetchEvents(start, end);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar evento');
    }
  };

  const updateEvent = async () => {
    if (!selectedEvent || !newEvent.title || !newEvent.start) return;

    try {
      const response = await fetch(`/api/google/eventos/${selectedEvent.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          titulo: newEvent.title,
          descricao: newEvent.description,
          local: newEvent.location,
          dataHoraInicio: newEvent.start,
          duracaoMinutos: Math.round((new Date(newEvent.end).getTime() - new Date(newEvent.start).getTime()) / (1000 * 60)),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao atualizar evento');

      toast.success('Evento atualizado com sucesso!');
      setIsEditDialogOpen(false);
      setSelectedEvent(null);
      // Refresh events
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      fetchEvents(start, end);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar evento');
    }
  };

  const deleteEvent = async () => {
    if (!selectedEvent) return;

    try {
      const response = await fetch(`/api/google/eventos/${selectedEvent.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao deletar evento');

      toast.success('Evento deletado com sucesso!');
      setIsEditDialogOpen(false);
      setSelectedEvent(null);
      // Refresh events
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      fetchEvents(start, end);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao deletar evento');
    }
  };

  const messages = {
    allDay: 'Todo o dia',
    previous: 'Anterior',
    next: 'Próximo',
    today: 'Hoje',
    month: 'Mês',
    week: 'Semana',
    day: 'Dia',
    agenda: 'Agenda',
    date: 'Data',
    time: 'Hora',
    event: 'Evento',
    noEventsInRange: 'Não há eventos neste período.',
    showMore: (total: number) => `+ Ver mais ${total}`,
  };

  return (
    <div className="w-full space-y-4">
      <Card className="w-full border border-border">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">📅 Sua Agenda</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Sincronizada com Google Calendar • Gerencie sua agenda conectada
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                  const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                  fetchEvents(start, end);
                }}
                disabled={loading}
                title="Sincronizar com Google Calendar"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '⟳'}
              </Button>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)} 
                size="sm" 
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Evento
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div style={{ height: '700px' }} className="rounded-b-lg overflow-hidden">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              selectable
              onNavigate={(date) => setCurrentDate(date)}
              messages={messages}
              culture="pt-BR"
              views={['month', 'week', 'day']}
              defaultView="month"
            />
          </div>
        </CardContent>
      </Card>

      {/* Create Event Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
              <div>
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Título do evento"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Descrição do evento"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start">Início</Label>
                  <Input
                    id="start"
                    type="datetime-local"
                    value={newEvent.start}
                    onChange={(e) => setNewEvent({ ...newEvent, start: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end">Fim</Label>
                  <Input
                    id="end"
                    type="datetime-local"
                    value={newEvent.end}
                    onChange={(e) => setNewEvent({ ...newEvent, end: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="location">Local</Label>
                <Input
                  id="location"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="Local do evento"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createMeet"
                  checked={newEvent.createMeet}
                  onCheckedChange={(checked) => setNewEvent({ ...newEvent, createMeet: !!checked })}
                />
                <Label htmlFor="createMeet">Criar reunião Google Meet</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={createEvent}>
                  Criar Evento
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Título</Label>
                <Input
                  id="edit-title"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Título do evento"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Descrição</Label>
                <Textarea
                  id="edit-description"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Descrição do evento"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-start">Início</Label>
                  <Input
                    id="edit-start"
                    type="datetime-local"
                    value={newEvent.start}
                    onChange={(e) => setNewEvent({ ...newEvent, start: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-end">Fim</Label>
                  <Input
                    id="edit-end"
                    type="datetime-local"
                    value={newEvent.end}
                    onChange={(e) => setNewEvent({ ...newEvent, end: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-location">Local</Label>
                <Input
                  id="edit-location"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="Local do evento"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="destructive" onClick={deleteEvent}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Deletar
                </Button>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={updateEvent}>
                  <Edit className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
