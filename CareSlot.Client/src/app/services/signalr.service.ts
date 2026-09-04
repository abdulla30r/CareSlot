import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { Slot } from '../models/schedule.models';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private hubConnection?: signalR.HubConnection;

  // Track the client's own unique connection ID
  public connectionId = signal<string>('');
  public isConnected = signal<boolean>(false);

  // Observable event stream whenever ANY slot is held, released, or booked in real-time
  public slotUpdated$ = new Subject<Slot>();

  public async startConnection(): Promise<void> {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    // Connects to /hubs/scheduling (proxied to http://localhost:5232 by proxy.conf.json)
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/scheduling')
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Register incoming event listeners
    this.hubConnection.on('SlotHeld', (slot: Slot) => {
      console.log('Real-Time Event: SlotHeld', slot);
      this.slotUpdated$.next(slot);
    });

    this.hubConnection.on('SlotReleased', (slot: Slot) => {
      console.log('Real-Time Event: SlotReleased', slot);
      this.slotUpdated$.next(slot);
    });

    this.hubConnection.on('SlotBooked', (slot: Slot) => {
      console.log('Real-Time Event: SlotBooked', slot);
      this.slotUpdated$.next(slot);
    });

    try {
      await this.hubConnection.start();
      this.isConnected.set(true);
      this.connectionId.set(this.hubConnection.connectionId ?? '');
      console.log('SignalR connected with Connection ID:', this.connectionId());
    } catch (err) {
      console.error('SignalR connection failed:', err);
      this.isConnected.set(false);
    }

    this.hubConnection.onreconnected((connectionId) => {
      this.isConnected.set(true);
      this.connectionId.set(connectionId ?? '');
      console.log('SignalR reconnected:', connectionId);
    });

    this.hubConnection.onclose(() => {
      this.isConnected.set(false);
      console.log('SignalR disconnected');
    });
  }

  public async joinDoctor(doctorId: string): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('JoinDoctorCalendar', doctorId);
    }
  }

  public async leaveDoctor(doctorId: string): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('LeaveDoctorCalendar', doctorId);
    }
  }
}

