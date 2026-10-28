"""Keep Windows from treating the API server as a background process.

Windows 11 power-throttles processes it considers background — ones with no
visible window, like a server started from an editor — while the user is
active in another app. On CPUs with performance and efficiency cores that
can park inference on the slow cores: the same 143-page upload measured
~6s while the machine was idle and ~90s while the user was clicking around
in the browser, with only a quarter of the CPU busy.

Opting out of execution-speed throttling and running slightly above normal
priority keeps indexing on the fast cores. Nothing here applies off Windows.
"""
import ctypes
import logging
import sys

log = logging.getLogger("documind")

_ABOVE_NORMAL_PRIORITY_CLASS = 0x00008000
_PROCESS_POWER_THROTTLING = 4  # PROCESS_INFORMATION_CLASS value
_THROTTLE_EXECUTION_SPEED = 0x1


def keep_server_responsive() -> None:
    if sys.platform != "win32":
        return
    try:
        from ctypes import wintypes as w

        class _ThrottleState(ctypes.Structure):
            _fields_ = [("Version", w.ULONG), ("ControlMask", w.ULONG),
                        ("StateMask", w.ULONG)]

        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        # Without these, the pseudo-handle is truncated and every call
        # silently fails.
        k32.GetCurrentProcess.restype = w.HANDLE
        k32.SetPriorityClass.argtypes = [w.HANDLE, w.DWORD]
        k32.SetPriorityClass.restype = w.BOOL
        k32.SetProcessInformation.argtypes = [w.HANDLE, ctypes.c_int,
                                              ctypes.c_void_p, w.DWORD]
        k32.SetProcessInformation.restype = w.BOOL

        me = k32.GetCurrentProcess()
        # Manage execution-speed throttling, with the state bit clear: never throttle.
        state = _ThrottleState(1, _THROTTLE_EXECUTION_SPEED, 0)
        unthrottled = k32.SetProcessInformation(
            me, _PROCESS_POWER_THROTTLING, ctypes.byref(state), ctypes.sizeof(state)
        )
        raised = k32.SetPriorityClass(me, _ABOVE_NORMAL_PRIORITY_CLASS)
        log.info("windows scheduling: power throttling off=%s, above-normal priority=%s",
                 bool(unthrottled), bool(raised))
    except Exception as exc:  # never let a scheduling hint stop the server
        log.warning("could not adjust windows scheduling: %s", exc)
