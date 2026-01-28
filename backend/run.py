import multiprocessing
from backend.listener import serve_listener
from backend.event_loop import serve_event_loop
from backend.server import serve_backend


def run_all_servers():
    processes = []

    p1 = multiprocessing.Process(target=serve_listener)
    p1.start()
    processes.append(p1)

    p2 = multiprocessing.Process(target=serve_event_loop)
    p2.start()
    processes.append(p2)

    p3 = multiprocessing.Process(target=serve_backend)
    p3.start()
    processes.append(p3)

    try:
        for p in processes:
            p.join()
    except KeyboardInterrupt:
        print("\nShutting down all servers...")
        for p in processes:
            p.terminate()
            p.join()
        print("All servers stopped.")


if __name__ == "__main__":
    run_all_servers()
